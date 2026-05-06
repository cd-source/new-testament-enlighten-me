import Capacitor

class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EnlightenSubscriptionsPlugin())
        bridge?.registerPluginInstance(ImageSharePlugin())
    }
}
