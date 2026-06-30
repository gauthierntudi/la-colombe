import 'package:flutter/material.dart';

/// Badge numérique pour navigation / notifications.
class NavCountBadge extends StatelessWidget {
  const NavCountBadge({
    super.key,
    required this.count,
    this.color = const Color(0xFF03B6EA),
    this.textColor = Colors.white,
    this.fontSize = 10,
  });

  final int count;
  final Color color;
  final Color textColor;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();

    final label = count > 99 ? '99+' : count > 9 ? '9+' : '$count';

    return Container(
      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
      padding: EdgeInsets.symmetric(horizontal: label.length > 1 ? 4 : 0),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white, width: 1.5),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}
