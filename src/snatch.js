const Settings = require('sketch/settings');
const UI = require('sketch/ui');

export function uploadSelect(context) {
  onRun(context, false);
}
export function setting(e) {
  onRun(context, true);
}

function exportLayerAsBitmap(document, layer, scale) {
  var slice,
    result = {},
    rect = layer.absoluteRect(),
    path = NSTemporaryDirectory() + layer.objectID() + '.png';
  NSMakeRect(rect.x(), rect.y(), rect.width(), rect.height()),
    (slice = MSExportRequest.exportRequestsFromExportableLayer(
      layer
    ).firstObject()),
    (slice.page = document.currentPage()),
    (slice.format = 'png'),
    (slice.scale = scale),
    document.saveArtboardOrSlice_toFile(slice, path);

  var url = NSURL.fileURLWithPath(path),
    bitmap = NSData.alloc().initWithContentsOfURL(url),
    base64 = bitmap.base64EncodedStringWithOptions(0);

  NSFileManager.defaultManager().removeItemAtURL_error(url, nil);
  var imgRep = NSBitmapImageRep.imageRepWithData(bitmap);
  return (
    (result.bitmap = base64),
    (result.width = imgRep.pixelsWide() / 4),
    (result.height = imgRep.pixelsHigh() / 4),
    result
  );
}

const onRun = function(context, setting) {
  const url = Settings.settingForKey('url');
  if (setting || !url) {
    UI.getInputFromUser(
      'Input the server address.',
      {
        initialValue: url || 'https://'
      },
      (err, value) => {
        if (err) {
          return;
        }
        return  Settings.setSettingForKey('url', value);
      }
    );
    return ;
  }

  const doc = context.document;
  const selection = context.selection;
  if (selection.count() == 0) {
    doc.showMessage('Please select the layer to upload.');
  } else {
    for (let i = 0; i < selection.count(); i++) {
      const layer = selection[i];
      const layerName = layer.name();
      const { bitmap } = exportLayerAsBitmap(doc, layer, 1);

      fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: { image: bitmap, name: layerName }
      })
        .then(response => response.text())
        .then(text => doc.showMessage(text))
        .catch(e => doc.showMessage(e.message));
    }
  }
};
