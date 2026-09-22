package com.tacticalptx.app

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject

/**
 * Acción «Rechazar» de la notificación CallStyle nativa (sin abrir UI).
 * Marca pending para que Dart limpie; el fin real de llamada lo hace el isolate
 * cuando pueda (o el usuario).
 */
class IncomingCallActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_REJECT = "com.tacticalptx.app.CALL_REJECT"
        private const val TAG = "IncomingCallAction"
        private const val PREFS = "FlutterSharedPreferences"
        private const val PENDING_KEY = "flutter.tacticalptx_pending_incoming_call_v1"
        private const val REJECT_KEY = "flutter.tacticalptx_reject_call_id_v1"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_REJECT) return
        val callId = intent.getStringExtra("callId").orEmpty()
        if (callId.isEmpty()) return
        Log.i(TAG, "reject from notification callId=$callId")
        try {
            val prefs = context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(REJECT_KEY, callId)
                .apply()
            val raw = prefs.getString(PENDING_KEY, null)
            if (raw != null && raw.contains(callId)) {
                prefs.edit().remove(PENDING_KEY).apply()
            }
        } catch (e: Exception) {
            Log.e(TAG, "prefs", e)
        }
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val id = IncomingCallWakeService.notifIdForCall(callId)
            nm.cancel("call:$callId", id)
            nm.cancel(id)
        } catch (e: Exception) {
            Log.e(TAG, "cancel notif", e)
        }
        // Señal mínima para logs / depuración.
        try {
            val marker = JSONObject()
            marker.put("callId", callId)
            marker.put("action", "reject")
            marker.put("at", System.currentTimeMillis())
        } catch (_: Exception) {
        }
    }
}
