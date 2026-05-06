#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ImageSharePlugin, "ImageShare",
    CAP_PLUGIN_METHOD(shareImage, CAPPluginReturnPromise);
)
