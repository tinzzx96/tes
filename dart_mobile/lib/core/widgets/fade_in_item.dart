import 'package:flutter/material.dart';

/// Animasi masuk yang SANGAT HALUS (fade + sedikit geser ke atas), dipakai
/// lintas screen untuk menghilangkan kesan "sepi/statis" tanpa terasa lebay.
///
/// Filosofi: nyaris tak disadari secara sadar, tapi membuat UI terasa
/// "hidup". Durasi pendek (380ms), pergeseran kecil (8px), kurva easeOut.
///
/// Pemakaian dasar:
/// ```dart
/// FadeInItem(child: MyCard())
/// ```
///
/// Untuk daftar (efek bertahap/stagger antar item), berikan [index] supaya
/// tiap item mulai sedikit lebih lambat dari item sebelumnya:
/// ```dart
/// ListView.builder(
///   itemBuilder: (_, i) => FadeInItem(index: i, child: Card(...)),
/// )
/// ```
class FadeInItem extends StatefulWidget {
  final Widget child;

  /// Urutan item dalam daftar — dipakai untuk menunda mulai animasi secara
  /// bertahap (stagger). 0 = mulai langsung.
  final int index;

  /// Jeda dasar tambahan sebelum animasi mulai (mis. menunggu header selesai).
  final Duration baseDelay;

  const FadeInItem({
    super.key,
    required this.child,
    this.index = 0,
    this.baseDelay = Duration.zero,
  });

  @override
  State<FadeInItem> createState() => _FadeInItemState();
}

class _FadeInItemState extends State<FadeInItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  // Stagger antar item dibatasi maksimal supaya daftar panjang tidak terasa
  // lambat — item ke-6 dan seterusnya mulai pada delay yang sama.
  static const int _maxStaggerItems = 6;
  static const Duration _perItemDelay = Duration(milliseconds: 60);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );

    _opacity = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _offset = Tween<Offset>(
      begin: const Offset(0, 0.04), // geser halus ~8px ke atas
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    final staggerIndex =
        widget.index > _maxStaggerItems ? _maxStaggerItems : widget.index;
    final totalDelay =
        widget.baseDelay + (_perItemDelay * staggerIndex);

    Future.delayed(totalDelay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}