import 'package:flutter/material.dart';

import '../config.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';

/// Image produit — réseau si disponible, sinon icône package.
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.name,
    this.imageUrl,
    this.size = 44,
    this.radius = 12,
  });

  final String name;
  final String? imageUrl;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final url = resolveApiAssetUrl(imageUrl);

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Container(
        width: size,
        height: size,
        color: AppColors.primarySoft,
        child: url != null
            ? Image.network(
                url,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _placeholder(),
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return Center(
                    child: SizedBox(
                      width: size * 0.35,
                      height: size * 0.35,
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    ),
                  );
                },
              )
            : _placeholder(),
      ),
    );
  }

  Widget _placeholder() {
    return Center(
      child: Icon(
        AppIcons.package,
        size: size * 0.45,
        color: AppColors.primary,
      ),
    );
  }
}
