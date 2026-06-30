import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';

class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.hint,
    this.onSubmitted,
    this.onSearch,
    this.loading = false,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onSearch;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            decoration: InputDecoration(
              hintText: hint,
              prefixIcon: const Icon(AppIcons.search),
              isDense: true,
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: onSubmitted,
          ),
        ),
        const SizedBox(width: 10),
        Material(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: loading ? null : onSearch,
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: 48,
              height: 48,
              child: Center(
                child: loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(AppIcons.search, color: Colors.white),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
