import 'dart:async';

import 'package:flutter/material.dart';

/// Titre animé type machine à écrire — salutations multilingues.
class TypewriterGreeting extends StatefulWidget {
  const TypewriterGreeting({super.key, required this.style});

  final TextStyle style;

  @override
  State<TypewriterGreeting> createState() => _TypewriterGreetingState();
}

class _TypewriterGreetingState extends State<TypewriterGreeting> {
  static const _accentColor = Color(0xFF03B6EA);

  static const _greetings = [
    'Bonjour',
    'Mbote',
    'Hello',
    'Jambo',
    'Kiambote',
    'Moyo',
    'Losako',
  ];

  static const _typeMs = 75;
  static const _deleteMs = 40;
  static const _holdMs = 1600;
  static const _pauseMs = 280;

  int _wordIndex = 0;
  int _charIndex = 0;
  bool _deleting = false;
  bool _cursorVisible = true;
  String _display = '';
  Timer? _timer;
  Timer? _cursorTimer;

  String get _fullWord => '${_greetings[_wordIndex]} !';

  @override
  void initState() {
    super.initState();
    _cursorTimer = Timer.periodic(const Duration(milliseconds: 530), (_) {
      if (mounted) setState(() => _cursorVisible = !_cursorVisible);
    });
    _scheduleNext();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _cursorTimer?.cancel();
    super.dispose();
  }

  void _scheduleNext() {
    _timer?.cancel();

    Duration delay;
    if (!_deleting) {
      if (_charIndex < _fullWord.length) {
        delay = const Duration(milliseconds: _typeMs);
      } else {
        delay = const Duration(milliseconds: _holdMs);
      }
    } else if (_charIndex > 0) {
      delay = const Duration(milliseconds: _deleteMs);
    } else {
      delay = const Duration(milliseconds: _pauseMs);
    }

    _timer = Timer(delay, _step);
  }

  void _step() {
    if (!mounted) return;

    setState(() {
      if (!_deleting) {
        if (_charIndex < _fullWord.length) {
          _charIndex++;
        } else {
          _deleting = true;
        }
      } else if (_charIndex > 0) {
        _charIndex--;
      } else {
        _deleting = false;
        _wordIndex = (_wordIndex + 1) % _greetings.length;
      }
      _display = _fullWord.substring(0, _charIndex);
    });

    _scheduleNext();
  }

  @override
  Widget build(BuildContext context) {
    final cursor = _cursorVisible ? '|' : ' ';
    final lineHeight = (widget.style.height ?? 1.1) * (widget.style.fontSize ?? 34);
    final word = _greetings[_wordIndex];
    final withSpace = '$word ';

    final String mainText;
    final String accentText;

    if (_charIndex <= word.length) {
      mainText = _display;
      accentText = '';
    } else if (_charIndex == word.length + 1) {
      mainText = withSpace;
      accentText = '';
    } else {
      mainText = withSpace;
      accentText = '!';
    }

    return SizedBox(
      height: lineHeight,
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(text: mainText, style: widget.style),
              if (accentText.isNotEmpty)
                TextSpan(
                  text: accentText,
                  style: widget.style.copyWith(color: _accentColor),
                ),
              TextSpan(
                text: cursor,
                style: widget.style.copyWith(
                  fontWeight: FontWeight.w300,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
          maxLines: 1,
        ),
      ),
    );
  }
}
