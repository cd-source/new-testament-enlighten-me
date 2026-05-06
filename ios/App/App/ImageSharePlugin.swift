import Foundation
import Capacitor
import UIKit
import LinkPresentation
import UniformTypeIdentifiers

@objc(ImageSharePlugin)
public class ImageSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ImageSharePlugin"
    public let jsName = "ImageShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareImage", returnType: CAPPluginReturnPromise),
    ]

    @objc func shareImage(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64") else {
            call.reject("Missing base64 image data")
            return
        }
        let cleaned: String = {
            if let comma = base64.range(of: ",") {
                return String(base64[comma.upperBound...])
            }
            return base64
        }()
        guard let data = Data(base64Encoded: cleaned, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("Invalid image data")
            return
        }

        let shareImage = image.renderedWithOpaqueBackground()
        guard let shareData = shareImage.pngData() else {
            call.reject("Unable to encode image for sharing")
            return
        }

        let dialogTitle = call.getString("dialogTitle") ?? "Share scripture card"
        let item = ImageActivityItem(image: shareImage, pngData: shareData, title: dialogTitle)

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let viewController = self.bridge?.viewController else {
                call.reject("No host view controller")
                return
            }
            if viewController.presentedViewController != nil {
                call.reject("Can't share while sharing is in progress")
                return
            }

            let avc = UIActivityViewController(activityItems: [item], applicationActivities: nil)
            avc.setValue(dialogTitle, forKey: "subject")

            if let popover = avc.popoverPresentationController {
                popover.sourceView = viewController.view
                popover.sourceRect = CGRect(
                    x: viewController.view.bounds.midX,
                    y: viewController.view.bounds.midY,
                    width: 0,
                    height: 0
                )
                popover.permittedArrowDirections = []
            }

            avc.completionWithItemsHandler = { activityType, completed, _, error in
                if let error = error {
                    call.reject("Share error: \(error.localizedDescription)")
                    return
                }
                call.resolve([
                    "completed": completed,
                    "activityType": activityType?.rawValue ?? "",
                ])
            }

            viewController.present(avc, animated: true, completion: nil)
        }
    }
}

private extension UIImage {
    func renderedWithOpaqueBackground() -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = scale

        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

private final class ImageActivityItem: NSObject, UIActivityItemSource {
    let image: UIImage
    let pngData: Data
    let title: String

    init(image: UIImage, pngData: Data, title: String) {
        self.image = image
        self.pngData = pngData
        self.title = title
        super.init()
    }

    func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
        return image
    }

    func activityViewController(_ controller: UIActivityViewController,
                                itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
        return pngData
    }

    func activityViewController(_ controller: UIActivityViewController,
                                dataTypeIdentifierForActivityType activityType: UIActivity.ActivityType?) -> String {
        return UTType.png.identifier
    }

    func activityViewController(_ controller: UIActivityViewController,
                                subjectForActivityType activityType: UIActivity.ActivityType?) -> String {
        return title
    }

    func activityViewController(_ controller: UIActivityViewController,
                                thumbnailImageForActivityType activityType: UIActivity.ActivityType?,
                                suggestedSize size: CGSize) -> UIImage? {
        return image
    }

    func activityViewControllerLinkMetadata(_ controller: UIActivityViewController) -> LPLinkMetadata? {
        let metadata = LPLinkMetadata()
        metadata.title = title
        metadata.imageProvider = NSItemProvider(object: image)
        metadata.iconProvider = NSItemProvider(object: image)
        return metadata
    }
}
