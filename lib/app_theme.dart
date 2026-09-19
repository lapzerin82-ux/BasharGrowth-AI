import 'package:flutter/material.dart';

/// Bright, friendly color palette used throughout the app.
class AppColors {
  static const Color purple = Color(0xFF8B5CF6);
  static const Color purpleDark = Color(0xFF6D28D9);
  static const Color teal = Color(0xFF14B8A6);
  static const Color pink = Color(0xFFFF6FA5);
  static const Color yellow = Color(0xFFFFC93C);
  static const Color sky = Color(0xFF4FC3F7);
  static const Color leaf = Color(0xFF6BCB77);
  static const Color coral = Color(0xFFFF8A5B);
}

class AppTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.purple,
        brightness: Brightness.light,
        secondary: AppColors.teal,
        tertiary: AppColors.pink,
      ),
    );

    const headingFamily = 'Baloo2';
    const bodyFamily = 'Quicksand';
    final headingFont = base.textTheme.apply(fontFamily: headingFamily);
    final bodyFont = base.textTheme.apply(fontFamily: bodyFamily);

    return base.copyWith(
      scaffoldBackgroundColor: const Color(0xFFFDF6FF),
      textTheme: bodyFont.copyWith(
        headlineSmall: headingFont.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.purpleDark,
        ),
        headlineMedium: headingFont.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
        ),
        titleLarge: headingFont.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      cardTheme: CardThemeData(
        elevation: 6,
        shadowColor: AppColors.purple.withOpacity(0.25),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        clipBehavior: Clip.antiAlias,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.purple.withOpacity(0.06),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: AppColors.purple, width: 2),
        ),
        labelStyle: bodyFont.bodyLarge?.copyWith(color: AppColors.purpleDark),
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        tileColor: AppColors.purple.withOpacity(0.06),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          foregroundColor: Colors.white,
          textStyle: headingFont.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      ),
    );
  }
}

/// A colorful rounded "sticker" badge with an emoji, used for section headers.
class StickerBadge extends StatelessWidget {
  final String emoji;
  final Color color;
  final double size;

  const StickerBadge({
    super.key,
    required this.emoji,
    required this.color,
    this.size = 40,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withOpacity(0.16),
        shape: BoxShape.circle,
      ),
      child: Text(emoji, style: TextStyle(fontSize: size * 0.52)),
    );
  }
}

/// A playful pill-shaped section title with a sticker badge.
class SectionTitle extends StatelessWidget {
  final String emoji;
  final String title;
  final Color color;

  const SectionTitle({
    super.key,
    required this.emoji,
    required this.title,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        StickerBadge(emoji: emoji, color: color, size: 36),
        const SizedBox(width: 10),
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontSize: 20,
                color: color,
              ),
        ),
      ],
    );
  }
}

/// A big, bouncy gradient button used for primary calls to action.
class GradientButton extends StatelessWidget {
  final String label;
  final String emoji;
  final VoidCallback onPressed;
  final List<Color> colors;

  const GradientButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.emoji = '✨',
    this.colors = const [AppColors.pink, AppColors.purple],
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(colors: colors),
        boxShadow: [
          BoxShadow(
            color: colors.last.withOpacity(0.4),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 18),
        ),
        child: Text('$label  $emoji', style: const TextStyle(fontSize: 18, color: Colors.white)),
      ),
    );
  }
}

/// Soft, blurred bubbles painted behind content for a friendly, playful feel.
class BubbleBackground extends StatelessWidget {
  const BubbleBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          _bubble(top: -60, left: -40, size: 180, color: AppColors.sky),
          _bubble(top: 90, right: -50, size: 140, color: AppColors.yellow),
          _bubble(bottom: 40, left: -60, size: 160, color: AppColors.leaf),
          _bubble(bottom: -70, right: -30, size: 200, color: AppColors.pink),
        ],
      ),
    );
  }

  Widget _bubble({double? top, double? bottom, double? left, double? right, required double size, required Color color}) {
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withOpacity(0.16),
        ),
      ),
    );
  }
}
