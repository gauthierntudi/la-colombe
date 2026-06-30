import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_colors.dart';

class AmountLabel extends StatelessWidget {
  const AmountLabel({
    super.key,
    required this.amount,
    this.style,
    this.compact = false,
  });

  final int amount;
  final TextStyle? style;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final base = style ??
        Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.text,
            );

    return Text(
      compact ? '${formatCdf(amount)} FC' : formatCdf(amount),
      style: base,
    );
  }
}

class AmountLabelLarge extends StatelessWidget {
  const AmountLabelLarge({super.key, required this.amount, this.suffix = ' FC'});

  final int amount;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    return Text(
      '${formatCdf(amount)}$suffix',
      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
    );
  }
}
