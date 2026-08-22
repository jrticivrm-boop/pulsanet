# La consola se cuelga — recuperación

Si **cmd, PowerShell y Cursor** se quedan congelados al abrir o al primer comando, el problema no es PulsaNet: es el **entorno Windows** (suele ser Defender, perfil de PowerShell, o un proceso colgado).

## 1) Reinicio limpio (hazlo ahora)

1. Cierra Cursor por completo.  
2. Administrador de tareas → finaliza `powershell.exe`, `pwsh.exe`, `OpenConsole.exe`, `WindowsTerminal.exe` si están.  
3. **Reinicia el PC.**

## 2) Probar consola fuera de Cursor

Tras reiniciar, **no abras Cursor todavía**.

`Windows + R` → `cmd` → Enter. Escribe solo:

```bat
echo hola
```

- Si **también se cuelga**: es Windows/Defender. Ve al paso 3.  
- Si **responde**: el fallo era el terminal de Cursor. Sigue al paso 4.

## 3) Si cmd del sistema también se cuelga

1. Windows Security → Virus y amenazas → **Exclusiones** → añade:
   - `C:\Users\INFORMATICA\.shorebird`
   - `C:\tools\flutter`
   - `D:\pulsanet`
   - `D:\Android\Sdk`
2. Reinicia otra vez.  
3. Prueba de nuevo `echo hola` en cmd.

Opcional: modo seguro con red y prueba `echo hola`.

## 4) Cuando cmd SÍ responda (sin Cursor)

```bat
cd /d D:\pulsanet\mobile
set PATH=C:\tools\flutter\bin;C:\Program Files\Git\cmd;%PATH%
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot
set ANDROID_HOME=D:\Android\Sdk
flutter pub get
flutter build apk --debug --dart-define=API_BASE=http://192.168.1.66:4000
```

APK:

`D:\pulsanet\mobile\build\app\outputs\flutter-apk\app-debug.apk`

Eso mándalo por WhatsApp. **Sin Shorebird** hasta que PowerShell funcione.

## 5) Shorebird (solo cuando PowerShell funcione)

```bat
powershell -NoProfile -Command "Write-Output OK"
```

Si imprime `OK`:

```bat
%USERPROFILE%\.shorebird\bin\shorebird.bat login
cd /d D:\pulsanet\mobile
%USERPROFILE%\.shorebird\bin\shorebird.bat init
%USERPROFILE%\.shorebird\bin\shorebird.bat release android --artifact apk -- --dart-define=API_BASE=http://192.168.1.66:4000
```

## 6) Alternativa GUI (si la consola sigue muerta)

1. Abre **Android Studio**.  
2. Open `D:\pulsanet\mobile`.  
3. Build → Flutter → Build APK.  
4. Copia el APK y envíalo por WhatsApp.

---

**Resumen:** no sigas lanzando más `.cmd` desde Cursor mientras todo cuelgue. Reinicia → prueba `echo hola` fuera de Cursor → build Flutter o Android Studio → WhatsApp.
