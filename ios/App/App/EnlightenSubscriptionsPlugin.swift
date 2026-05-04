import Foundation
import Capacitor
import StoreKit

@objc(EnlightenSubscriptionsPlugin)
public class EnlightenSubscriptionsPlugin: CAPPlugin {

    @objc func getStatus(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        guard #available(iOS 15.0, *) else {
            call.resolve(self.unsupportedPayload(productId: productId))
            return
        }
        Task {
            let active = await self.isActiveEntitlement(productId: productId)
            call.resolve(self.payload(isActive: active, productId: productId, source: "ios.storekit2"))
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15+.")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found: \(productId). Confirm Run > Options > StoreKit Configuration is set to Enlighten.storekit.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(self.payload(isActive: true, productId: productId, source: "ios.storekit2.purchase"))
                    case .unverified(_, let error):
                        call.reject("Transaction unverified: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.reject("User cancelled the purchase.")
                case .pending:
                    call.resolve(self.payload(isActive: false, productId: productId, source: "ios.storekit2.pending"))
                @unknown default:
                    call.reject("Unknown purchase state.")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        guard #available(iOS 15.0, *) else {
            call.resolve(self.unsupportedPayload(productId: productId))
            return
        }
        Task {
            do {
                try await AppStore.sync()
                let active = await self.isActiveEntitlement(productId: productId)
                call.resolve(self.payload(isActive: active, productId: productId, source: "ios.storekit2.restore"))
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    @available(iOS 15.0, *)
    private func isActiveEntitlement(productId: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            if transaction.productID != productId { continue }
            if transaction.revocationDate != nil { continue }
            if let expirationDate = transaction.expirationDate, expirationDate < Date() { continue }
            return true
        }
        return false
    }

    private func payload(isActive: Bool, productId: String, source: String) -> [String: Any] {
        return [
            "isActive": isActive,
            "productId": productId,
            "entitlementToken": "",
            "source": source
        ]
    }

    private func unsupportedPayload(productId: String) -> [String: Any] {
        return [
            "isActive": false,
            "productId": productId,
            "entitlementToken": "",
            "source": "unsupported"
        ]
    }
}
