import 'dart:io';

import 'package:flutter/foundation.dart';

/// Canales MethodChannel de MainActivity solo existen en Android.
/// En iOS/web no invocar: evita `MissingPluginException` en logs y spinners.
bool get kIsAndroidNative => !kIsWeb && Platform.isAndroid;
