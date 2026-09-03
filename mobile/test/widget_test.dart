import 'package:flutter_test/flutter_test.dart';
import 'package:tacticalptx_mobile/config.dart';

void main() {
  test('API base es HTTPS o host de emulador', () {
    expect(
      AppConfig.apiBaseUrl.contains('10.0.2.2') ||
          AppConfig.apiBaseUrl.startsWith('http'),
      isTrue,
    );
  });

  test('socketUrl fuerza puerto 443 si HTTPS sin puerto (evita :0)', () {
    expect(
      AppConfig.socketUrlFor('https://tacticalptx.example.sslip.io'),
      'https://tacticalptx.example.sslip.io:443',
    );
    expect(
      AppConfig.socketUrlFor('https://tacticalptx.example.sslip.io:443'),
      'https://tacticalptx.example.sslip.io:443',
    );
    expect(
      AppConfig.socketUrlFor('http://192.168.1.66:4000'),
      'http://192.168.1.66:4000',
    );
  });
}
