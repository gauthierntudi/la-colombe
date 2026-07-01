import 'package:flutter/material.dart';

import '../config.dart';
import '../theme/app_colors.dart';

/// Avatar utilisateur — photo réseau si disponible, sinon initiales.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.imageUrl,
    this.radius = 22,
    this.backgroundColor,
    this.initialsColor,
  });

  final String name;
  final String? imageUrl;
  final double radius;
  final Color? backgroundColor;
  final Color? initialsColor;

  String _initials(String value) {
    final parts = value.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? Colors.white.withValues(alpha: 0.22);
    final fg = initialsColor ?? Colors.white;
    final url = resolveApiAssetUrl(imageUrl);

    if (url != null && url.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bg,
        child: ClipOval(
          child: Image.network(
            url,
            width: radius * 2,
            height: radius * 2,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _Initials(
              initials: _initials(name),
              color: fg,
              fontSize: radius * 0.72,
            ),
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return SizedBox(
                width: radius * 1.2,
                height: radius * 1.2,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: fg.withValues(alpha: 0.8),
                ),
              );
            },
          ),
        ),
      );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: bg,
      child: _Initials(
        initials: _initials(name),
        color: fg,
        fontSize: radius * 0.72,
      ),
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials({
    required this.initials,
    required this.color,
    required this.fontSize,
  });

  final String initials;
  final Color color;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Text(
      initials,
      style: TextStyle(
        color: color,
        fontWeight: FontWeight.w700,
        fontSize: fontSize,
      ),
    );
  }
}

/// Variante pour fond clair (listes, app bar).
class UserAvatarLight extends StatelessWidget {
  const UserAvatarLight({
    super.key,
    required this.name,
    this.imageUrl,
    this.radius = 20,
  });

  final String name;
  final String? imageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return UserAvatar(
      name: name,
      imageUrl: imageUrl,
      radius: radius,
      backgroundColor: AppColors.primarySoft,
      initialsColor: AppColors.primary,
    );
  }
}
