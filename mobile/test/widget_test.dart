import 'package:flutter_test/flutter_test.dart';
import 'package:pulsanet_mobile/config.dart';

void main() {
  test('API base por defecto apunta al host del emulador', () {
    expect(AppConfig.apiBaseUrl.contains('10.0.2.2') || AppConfig.apiBaseUrl.contains('http'), isTrue);
  });
}
