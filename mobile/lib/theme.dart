import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Tema institucional (oliva / oro) — ligero, plano, presentable.
const Color kInstOlive = Color(0xFF243D20);
const Color kInstOliveMid = Color(0xFF355C2E);
const Color kInstGold = Color(0xFF9A7B2F);
const Color kInstInk = Color(0xFF172015);
const Color kInstMuted = Color(0xFF5C6756);
const Color kInstPaper = Color(0xFFE6EAE1);
const Color kInstSurface = Color(0xFFF8F9F5);
const Color kInstDanger = Color(0xFF7A1F1F);
const Color kInstOk = Color(0xFF1F5A2E);

/// Alias de compatibilidad con pantallas existentes.
const Color kRadioBlue = kInstOlive;
const Color kRadioBlueDark = Color(0xFF1C2E19);
const Color kTacticalGold = kInstGold;
const Color kTacticalBlack = kInstPaper;
const Color kRadioInk = kInstInk;
const Color kRadioMuted = kInstMuted;
const Color kRadioSurface = kInstSurface;
const Color kRadioDanger = kInstDanger;

final tacticalTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.light,
  colorScheme: const ColorScheme.light(
    primary: kInstOlive,
    secondary: kInstGold,
    surface: kInstSurface,
    error: kInstDanger,
    onPrimary: Color(0xFFF4F7F1),
    onSecondary: kInstInk,
    onSurface: kInstInk,
    onError: Colors.white,
  ),
  scaffoldBackgroundColor: kInstPaper,
  fontFamily: 'Roboto',
  appBarTheme: const AppBarTheme(
    centerTitle: false,
    backgroundColor: kInstSurface,
    elevation: 0,
    scrolledUnderElevation: 0,
    foregroundColor: kInstInk,
    systemOverlayStyle: SystemUiOverlayStyle.dark,
    titleTextStyle: TextStyle(
      color: kInstOlive,
      fontWeight: FontWeight.w700,
      fontSize: 18,
      letterSpacing: 0.4,
    ),
  ),
  cardTheme: const CardThemeData(
    color: kInstSurface,
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      side: BorderSide(color: Color(0xFFC2CBB8)),
      borderRadius: BorderRadius.zero,
    ),
  ),
  dividerTheme: const DividerThemeData(color: Color(0xFFC2CBB8), thickness: 1),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    labelStyle: const TextStyle(color: kInstMuted, fontWeight: FontWeight.w600),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.zero,
      borderSide: const BorderSide(color: Color(0xFF7F9170)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.zero,
      borderSide: const BorderSide(color: Color(0xFF7F9170)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.zero,
      borderSide: const BorderSide(color: kInstGold, width: 2),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: kInstOlive,
      foregroundColor: const Color(0xFFF4F7F1),
      elevation: 0,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      textStyle: const TextStyle(
        fontWeight: FontWeight.w700,
        letterSpacing: 0.08,
      ),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: kInstOlive,
      side: const BorderSide(color: Color(0xFFC2CBB8)),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
    ),
  ),
  bottomNavigationBarTheme: const BottomNavigationBarThemeData(
    backgroundColor: kInstSurface,
    selectedItemColor: kInstOlive,
    unselectedItemColor: kInstMuted,
    type: BottomNavigationBarType.fixed,
    elevation: 0,
    showSelectedLabels: false,
    showUnselectedLabels: false,
  ),
  snackBarTheme: const SnackBarThemeData(
    backgroundColor: kInstOlive,
    contentTextStyle: TextStyle(color: Color(0xFFF4F7F1)),
    behavior: SnackBarBehavior.floating,
  ),
);
