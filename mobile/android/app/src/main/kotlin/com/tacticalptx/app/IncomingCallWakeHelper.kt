package com.tacticalptx.app

import android.app.ActivityManager
import android.app.ActivityManager.RunningAppProcessInfo
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import org.json.JSONObject

/**
 * Persistencia alineada con IncomingCallWake (Dart) + arranque del FGS nativo.
 * Se invoca desde el BroadcastReceiver FCM (antes del isolate Dart), donde el
 * MethodChannel de MainActivity no existe.
 */
object IncomingCallWakeHelper {
    private const val TAG = "IncomingCallWake"
    private const val PREFS = "FlutterSharedPreferences"
    private const val PENDING_KEY = "flutter.tacticalptx_pending_incoming_call_v1"

    private val CALL_TYPES = setOf(
        "private_call",
        "private_radio",
        "private_video",
        "private_call_invite",
        "private_video_invite",
        "private_video_request",
        "group_video",
    )

    fun isCallPushType(type: String?): Boolean {
        if (type.isNullOrBlank()) return false
        return CALL_TYPES.contains(type)
    }

    /** Equivalente a FlutterFire isApplicationForeground (package-private allí). */
    fun isAppInForeground(context: Context): Boolean {
        return try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val processes = am.runningAppProcesses ?: return false
            val pkg = context.packageName
            for (proc in processes) {
                if (proc.processName == pkg &&
                    proc.importance == RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                ) {
                    return true
                }
            }
            false
        } catch (_: Exception) {
            false
        }
    }

    fun wake(context: Context, data: Map<String, String>) {
        val type = data["type"]
        if (!isCallPushType(type)) return
        // group_video sin callId: solo Contestar 1:1 / video 1:1 aquí.
        val callId = data["callId"].orEmpty()
        if (callId.isEmpty()) {
            Log.i(TAG, "skip native wake (sin callId) type=$type")
            return
        }
        try {
            persistPending(context, data)
        } catch (e: Exception) {
            Log.e(TAG, "persistPending", e)
        }
        try {
            IncomingCallWakeService.start(context.applicationContext, data)
        } catch (e: Exception) {
            Log.e(TAG, "IncomingCallWakeService.start", e)
            try {
                launchMainActivity(context.applicationContext, data)
            } catch (e2: Exception) {
                Log.e(TAG, "launchMainActivity fallback", e2)
            }
        }
    }

    fun persistPending(context: Context, data: Map<String, String>) {
        val callId = data["callId"].orEmpty()
        if (callId.isEmpty()) return
        val json = JSONObject()
        json.put("callId", callId)
        json.put("callerId", data["callerId"] ?: JSONObject.NULL)
        json.put(
            "callerName",
            data["callerName"] ?: data["title"] ?: "Usuario",
        )
        json.put("mode", data["mode"] ?: "call")
        json.put("intent", data["intent"] ?: JSONObject.NULL)
        json.put("type", data["type"] ?: "private_call")
        json.put("title", data["title"] ?: JSONObject.NULL)
        json.put("body", data["body"] ?: JSONObject.NULL)
        if (data["autoAccept"] == "1") {
            json.put("autoAccept", "1")
        }
        json.put("savedAt", System.currentTimeMillis())
        prefs(context).edit().putString(PENDING_KEY, json.toString()).apply()
    }

    fun persistAccept(context: Context, callId: String) {
        if (callId.isEmpty()) return
        val existing = prefs(context).getString(PENDING_KEY, null)
        val json = try {
            if (existing.isNullOrBlank()) JSONObject() else JSONObject(existing)
        } catch (_: Exception) {
            JSONObject()
        }
        if (json.optString("callId") != callId && json.has("callId")) {
            json.keys().asSequence().toList().forEach { json.remove(it) }
        }
        json.put("callId", callId)
        json.put("type", json.optString("type", "private_call"))
        json.put("mode", json.optString("mode", "call"))
        json.put("callerName", json.optString("callerName", "Usuario"))
        json.put("autoAccept", "1")
        json.put("savedAt", System.currentTimeMillis())
        prefs(context).edit().putString(PENDING_KEY, json.toString()).apply()
    }

    fun launchMainActivity(context: Context, data: Map<String, String>? = null) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            putExtra("tacticalptx_incoming_call", true)
            data?.get("callId")?.let { putExtra("tacticalptx_call_id", it) }
            data?.get("autoAccept")?.let { putExtra("tacticalptx_auto_accept", it) }
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED,
            )
        }
        if (Build.VERSION.SDK_INT >= 34) {
            val opts = android.app.ActivityOptions.makeBasic()
            @Suppress("DEPRECATION")
            opts.setPendingIntentBackgroundActivityStartMode(
                android.app.ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED,
            )
            context.startActivity(intent, opts.toBundle())
        } else {
            context.startActivity(intent)
        }
    }

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
