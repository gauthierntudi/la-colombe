import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_palette.dart';
import '../theme/app_theme.dart';

/// Contrôleur pour ouvrir la recherche plein écran depuis l'extérieur.
class FullscreenSearchController {
  _FullscreenSearchState? _state;

  void _attach(_FullscreenSearchState state) => _state = state;

  void _detach() => _state = null;

  void open() => _state?._open();

  bool get isOpen => _state?._expanded ?? false;
}

/// Overlay de recherche plein écran, déclenché par un bouton externe.
class ExpandableFullscreenSearch extends StatefulWidget {
  const ExpandableFullscreenSearch({
    super.key,
    required this.launcher,
    required this.textController,
    required this.hint,
    required this.loading,
    required this.onSearch,
    required this.child,
    required this.results,
    this.debounce = const Duration(milliseconds: 350),
  });

  final FullscreenSearchController launcher;
  final TextEditingController textController;
  final String hint;
  final bool loading;
  final VoidCallback onSearch;
  final Widget child;
  final Widget results;
  final Duration debounce;

  @override
  State<ExpandableFullscreenSearch> createState() =>
      _FullscreenSearchState();
}

class _FullscreenSearchState extends State<ExpandableFullscreenSearch> {
  final _focusNode = FocusNode();
  Timer? _debounce;
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    widget.launcher._attach(this);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    if (_expanded) {
      SystemChrome.setSystemUIOverlayStyle(AppPalette.light.statusBarStyle);
    }
    widget.launcher._detach();
    _focusNode.dispose();
    super.dispose();
  }

  void _applySearchStatusBar() {
    SystemChrome.setSystemUIOverlayStyle(AppTheme.statusBarOnLight(context));
  }

  void _restoreStatusBar() {
    SystemChrome.setSystemUIOverlayStyle(context.palette.statusBarStyle);
  }

  void _open() {
    setState(() => _expanded = true);
    _applySearchStatusBar();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  void _close() {
    _debounce?.cancel();
    _focusNode.unfocus();
    setState(() => _expanded = false);
    _restoreStatusBar();
  }

  void _searchNow() {
    _debounce?.cancel();
    widget.onSearch();
  }

  void _onQueryChanged(String _) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(widget.debounce, widget.onSearch);
  }

  Widget? _suffixIcon() {
    if (widget.loading) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.primary,
          ),
        ),
      );
    }
    if (widget.textController.text.isEmpty) return null;
    return IconButton(
      onPressed: () {
        widget.textController.clear();
        _searchNow();
      },
      icon: const Icon(AppIcons.close, size: 20, color: AppColors.primary),
    );
  }

  InputDecoration _inputDecoration({Widget? suffix}) {
    return InputDecoration(
      hintText: widget.hint,
      prefixIcon: const Icon(AppIcons.search, color: AppColors.primary),
      suffixIcon: suffix,
      isDense: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_expanded)
          Positioned.fill(
            child: AnnotatedRegion<SystemUiOverlayStyle>(
              value: AppTheme.statusBarOnLight(context),
              child: Material(
                color: AppColors.background,
                child: SafeArea(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: _close,
                              icon: const Icon(
                                AppIcons.arrowLeft,
                                color: AppColors.primary,
                              ),
                              tooltip: 'Fermer',
                            ),
                            Expanded(
                              child: TextField(
                                controller: widget.textController,
                                focusNode: _focusNode,
                                cursorColor: AppColors.primary,
                                style: TextStyle(color: AppColors.text),
                                decoration: _inputDecoration(
                                  suffix: _suffixIcon(),
                                ).copyWith(
                                  prefixIconColor: AppColors.primary,
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                      color: AppColors.primary,
                                      width: 1.5,
                                    ),
                                  ),
                                ),
                                textInputAction: TextInputAction.search,
                                onSubmitted: (_) => _searchNow(),
                                onChanged: _onQueryChanged,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Divider(height: 1, color: AppColors.border),
                      Expanded(child: widget.results),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
