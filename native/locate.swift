// Prints this Mac's position once, as JSON, and exits: {"latitude":51.4,"longitude":-0.6} or {"error":"denied"}.
// Central Command runs it (as the small background app Locate.app, which macOS needs to ask for permission) when Weather is on.
// The position is rounded to one decimal, about a town, before it is printed: nothing more precise leaves this process.
import CoreLocation
import Foundation

final class Locator: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()

  func start() {
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyKilometer
    switch manager.authorizationStatus {
    case .notDetermined: manager.requestWhenInUseAuthorization()
    case .denied, .restricted: finish(["error": "denied"])
    default: manager.requestLocation()
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .denied, .restricted: finish(["error": "denied"])
    case .notDetermined: break
    default: manager.requestLocation()
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let here = locations.last else { return finish(["error": "unavailable"]) }
    finish([
      "latitude": (here.coordinate.latitude * 10).rounded() / 10,
      "longitude": (here.coordinate.longitude * 10).rounded() / 10
    ])
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let denied = (error as? CLError)?.code == .denied
    finish(["error": denied ? "denied" : "unavailable"])
  }

  private func finish(_ result: [String: Any]) {
    let data = try? JSONSerialization.data(withJSONObject: result)
    print(String(data: data ?? Data(), encoding: .utf8) ?? "{\"error\":\"unavailable\"}")
    exit(0)
  }
}

let locator = Locator()
locator.start()
// No answer (for instance the permission question is left open) is "unavailable", never a hang.
DispatchQueue.main.asyncAfter(deadline: .now() + 45) {
  print("{\"error\":\"unavailable\"}")
  exit(0)
}
RunLoop.main.run()
