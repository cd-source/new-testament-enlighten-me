import Foundation
import Capacitor
import StoreKit

@objc(EnlightenSubscriptionsPlugin)
public class EnlightenSubscriptionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EnlightenSubscriptionsPlugin"
    public let jsName = "EnlightenSubscriptions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    @objc func getStatus(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        let apiBase = call.getString("apiBase") ?? ""
        guard #available(iOS 15.0, *) else {
            call.resolve(self.unsupportedPayload(productId: productId))
            return
        }
        Task {
            let entitlement = await self.activeEntitlement(productId: productId)
            let token = await self.tokenForEntitlement(entitlement, productId: productId, apiBase: apiBase)
            call.resolve(self.payload(
                isActive: entitlement != nil,
                productId: productId,
                source: "ios.storekit2",
                token: token
            ))
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        let apiBase = call.getString("apiBase") ?? ""
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
                        let token = await self.exchangeForServerToken(
                            jws: verification.jwsRepresentation,
                            productId: productId,
                            apiBase: apiBase
                        )
                        await transaction.finish()
                        call.resolve(self.payload(
                            isActive: true,
                            productId: productId,
                            source: "ios.storekit2.purchase",
                            token: token
                        ))
                    case .unverified(_, let error):
                        call.reject("Transaction unverified: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.reject("User cancelled the purchase.")
                case .pending:
                    call.resolve(self.payload(isActive: false, productId: productId, source: "ios.storekit2.pending", token: ""))
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
        let apiBase = call.getString("apiBase") ?? ""
        guard #available(iOS 15.0, *) else {
            call.resolve(self.unsupportedPayload(productId: productId))
            return
        }
        Task {
            do {
                try await AppStore.sync()
                let entitlement = await self.activeEntitlement(productId: productId)
                let token = await self.tokenForEntitlement(entitlement, productId: productId, apiBase: apiBase)
                call.resolve(self.payload(
                    isActive: entitlement != nil,
                    productId: productId,
                    source: "ios.storekit2.restore",
                    token: token
                ))
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    @available(iOS 15.0, *)
    private func activeEntitlement(productId: String) async -> VerificationResult<Transaction>? {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            if transaction.productID != productId { continue }
            if transaction.revocationDate != nil { continue }
            if let expirationDate = transaction.expirationDate, expirationDate < Date() { continue }
            return result
        }
        return nil
    }

    @available(iOS 15.0, *)
    private func tokenForEntitlement(_ verification: VerificationResult<Transaction>?, productId: String, apiBase: String) async -> String {
        guard let verification = verification else { return "" }
        return await self.exchangeForServerToken(
            jws: verification.jwsRepresentation,
            productId: productId,
            apiBase: apiBase
        )
    }

    private func exchangeForServerToken(jws: String, productId: String, apiBase: String) async -> String {
        guard !apiBase.isEmpty, !jws.isEmpty,
              let url = URL(string: "\(apiBase)/api/entitlement") else {
            return ""
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15

        let body: [String: String] = ["jws": jws, "productId": productId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return "" }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return (json?["entitlementToken"] as? String) ?? ""
        } catch {
            return ""
        }
    }

    private func payload(isActive: Bool, productId: String, source: String, token: String) -> [String: Any] {
        return [
            "isActive": isActive,
            "productId": productId,
            "entitlementToken": token,
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
