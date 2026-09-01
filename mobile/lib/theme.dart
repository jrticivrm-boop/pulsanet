import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Paleta TacticalPtx — tema institucional claro (oliva / oro).
const Color kTacBg = Color(0xFFE6EAE1);
const Color kTacHeader = Color(0xFFF8F9F5);
const Color kTacSurface = Color(0xFFF8F9F5);
const Color kTacPanel = Color(0xFFEEF1EA);
const Color kTacBorder = Color(0xFFD5DCCE);
const Color kTacOnSurface = Color(0xFF172015);
const Color kTacMuted = Color(0xFF5C6756);
const Color kTacGold = Color(0xFF9A7B2F);
const Color kTacGoldSoft = Color(0xFFB8943F);
const Color kTacBubbleMine = Color(0xFFDCE8D4);
const Color kTacBubbleOther = Color(0xFFFFFFFF);
const Color kTacInputBar = Color(0xFFF8F9F5);

/// Alias institucionales.
const Color kInstOlive = Color(0xFF243D20);
const Color kInstOliveMid = Color(0xFF355C2E);
const Color kInstOliveDeep = Color(0xFF1C2E19);
const Color kInstGold = kTacGold;
const Color kInstGoldSoft = kTacGoldSoft;
const Color kInstInk = kTacOnSurface;
const Color kInstMuted = kTacMuted;
const Color kInstPaper = kTacBg;
const Color kInstPaper2 = kTacPanel;
const Color kInstSurface = kTacSurface;
const Color kInstPanel2 = kTacPanel;
const Color kInstBorder = kTacBorder;
const Color kInstDanger = Color(0xFF7A1F1F);
const Color kInstOk = Color(0xFF1F5A2E);
const Color kInstOnPrimary = Color(0xFFF4F7F1);

/// Fondos de llamadas.
const Color kInstCallBg = Color(0xFF0C1410);
const Color kInstCallSurface = Color(0xFF152018);

/// Alias de compatibilidad.
const Color kRadioBlue = kInstOlive;
const Color kRadioBlueDark = kInstOliveDeep;
const Color kTacticalGold = kInstGold;
const Color kTacticalBlack = kTacBg;
const Color kRadioInk = kInstInk;
const Color kRadioMuted = kInstMuted;
const Color kRadioSurface = kInstSurface;
const Color kRadioDanger = kInstDanger;

/// Tipografía institucional (Oswald + Source Sans 3).
abstract final class TacticalFonts {
  static TextStyle display({
    double fontSize = 28,
    FontWeight fontWeight = FontWeight.w600,
    Color? color,
    double letterSpacing = 1.2,
    double? height,
  }) =>
      GoogleFonts.oswald(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color ?? kTacOnSurface,
        letterSpacing: letterSpacing,
        height: height,
      );

  static TextStyle body({
    double fontSize = 15,
    FontWeight fontWeight = FontWeight.w500,
    Color? color,
    double letterSpacing = 0.1,
    double? height,
  }) =>
      GoogleFonts.sourceSans3(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color ?? kTacOnSurface,
        letterSpacing: letterSpacing,
        height: height,
      );

  static TextStyle label({
    double fontSize = 11,
    FontWeight fontWeight = FontWeight.w700,
    Color? color,
    double letterSpacing = 1.4,
  }) =>
      GoogleFonts.sourceSans3(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color ?? kTacGold,
        letterSpacing: letterSpacing,
      );
}

TextTheme _buildTextTheme() {
  final body = GoogleFonts.sourceSans3TextTheme(ThemeData.light().textTheme);
  final display = GoogleFonts.oswaldTextTheme(ThemeData.light().textTheme);
  return body.copyWith(
    displayLarge: display.displayLarge?.copyWith(
      fontWeight: FontWeight.w600,
      letterSpacing: 1.2,
      color: kTacOnSurface,
    ),
    displayMedium: display.displayMedium?.copyWith(
      fontWeight: FontWeight.w600,
      letterSpacing: 1.0,
      color: kTacOnSurface,
    ),
    displaySmall: display.displaySmall?.copyWith(
      fontWeight: FontWeight.w600,
      letterSpacing: 0.8,
      color: kTacOnSurface,
    ),
    headlineLarge: display.headlineLarge?.copyWith(
      fontWeight: FontWeight.w600,
      color: kInstOlive,
      letterSpacing: 0.6,
    ),
    headlineMedium: display.headlineMedium?.copyWith(
      fontWeight: FontWeight.w600,
      color: kInstOlive,
      letterSpacing: 0.5,
    ),
    headlineSmall: display.headlineSmall?.copyWith(
      fontWeight: FontWeight.w600,
      color: kInstOlive,
    ),
    titleLarge: body.titleLarge?.copyWith(
      fontWeight: FontWeight.w700,
      color: kTacOnSurface,
      letterSpacing: 0.2,
    ),
    titleMedium: body.titleMedium?.copyWith(
      fontWeight: FontWeight.w700,
      color: kTacOnSurface,
    ),
    titleSmall: body.titleSmall?.copyWith(
      fontWeight: FontWeight.w600,
      color: kTacMuted,
      letterSpacing: 0.3,
    ),
    bodyLarge: body.bodyLarge?.copyWith(
      fontWeight: FontWeight.w500,
      color: kTacOnSurface,
      height: 1.35,
    ),
    bodyMedium: body.bodyMedium?.copyWith(
      fontWeight: FontWeight.w500,
      color: kTacOnSurface,
      height: 1.35,
    ),
    bodySmall: body.bodySmall?.copyWith(
      fontWeight: FontWeight.w500,
      color: kTacMuted,
    ),
    labelLarge: body.labelLarge?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: 0.8,
      color: kTacOnSurface,
    ),
    labelMedium: body.labelMedium?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: 1.0,
      color: kTacMuted,
    ),
    labelSmall: body.labelSmall?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: 1.2,
      color: kTacMuted,
    ),
  );
}

final tacticalTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.light,
  colorScheme: const ColorScheme.light(
    primary: kInstOlive,
    secondary: kTacGold,
    surface: kTacSurface,
    error: kInstDanger,
    onPrimary: kInstOnPrimary,
    onSecondary: kTacOnSurface,
    onSurface: kTacOnSurface,
    onError: Colors.white,
  ),
  scaffoldBackgroundColor: kTacBg,
  textTheme: _buildTextTheme(),
  primaryTextTheme: _buildTextTheme(),
  iconTheme: const IconThemeData(color: kInstOlive, size: 22),
  primaryIconTheme: const IconThemeData(color: kInstOnPrimary, size: 22),
  appBarTheme: AppBarTheme(
    centerTitle: false,
    backgroundColor: kTacHeader,
    elevation: 0,
    scrolledUnderElevation: 0,
    foregroundColor: kTacOnSurface,
    systemOverlayStyle: SystemUiOverlayStyle.dark,
    iconTheme: const IconThemeData(color: kInstOlive),
    titleTextStyle: TacticalFonts.display(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: kInstOlive,
      letterSpacing: 0.6,
    ),
  ),
  cardTheme: CardThemeData(
    color: kTacSurface,
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      side: const BorderSide(color: kTacBorder),
      borderRadius: BorderRadius.circular(14),
    ),
  ),
  dividerTheme: const DividerThemeData(color: kTacBorder, thickness: 1),
  chipTheme: ChipThemeData(
    backgroundColor: kTacPanel,
    selectedColor: kInstOlive.withValues(alpha: 0.12),
    side: const BorderSide(color: kTacBorder),
    labelStyle: TacticalFonts.body(fontSize: 12, fontWeight: FontWeight.w600),
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
    shape: const StadiumBorder(),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: kTacSurface,
    labelStyle: TacticalFonts.body(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: kTacMuted,
    ),
    hintStyle: TacticalFonts.body(fontSize: 14, color: kTacMuted),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: kTacBorder),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: kTacBorder),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: kInstOlive, width: 2),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: kInstOlive,
      foregroundColor: kInstOnPrimary,
      elevation: 0,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: TacticalFonts.body(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: kInstOnPrimary,
      ),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: kInstOlive,
      side: const BorderSide(color: kTacBorder),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: TacticalFonts.body(fontWeight: FontWeight.w700),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: kInstOlive,
      textStyle: TacticalFonts.body(fontWeight: FontWeight.w700),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: kTacHeader,
    indicatorColor: kInstOlive.withValues(alpha: 0.12),
    labelTextStyle: WidgetStateProperty.resolveWith((states) {
      final selected = states.contains(WidgetState.selected);
      return TacticalFonts.body(
        fontSize: 12,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
        color: selected ? kInstOlive : kTacMuted,
      );
    }),
    iconTheme: WidgetStateProperty.resolveWith((states) {
      final selected = states.contains(WidgetState.selected);
      return IconThemeData(
        color: selected ? kInstOlive : kTacMuted,
        size: 22,
      );
    }),
  ),
  bottomNavigationBarTheme: const BottomNavigationBarThemeData(
    backgroundColor: kTacHeader,
    selectedItemColor: kInstOlive,
    unselectedItemColor: kTacMuted,
    type: BottomNavigationBarType.fixed,
    elevation: 0,
    showSelectedLabels: true,
    showUnselectedLabels: true,
  ),
  snackBarTheme: SnackBarThemeData(
    backgroundColor: kInstOliveDeep,
    contentTextStyle: TacticalFonts.body(
      color: kInstOnPrimary,
      fontWeight: FontWeight.w600,
    ),
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  ),
  dialogTheme: DialogThemeData(
    backgroundColor: kTacSurface,
    titleTextStyle: TacticalFonts.display(fontSize: 18, color: kTacOnSurface),
    contentTextStyle: TacticalFonts.body(color: kTacMuted),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: kTacSurface,
    modalBackgroundColor: kTacSurface,
  ),
);
