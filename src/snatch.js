const Settings = require('sketch/settings');
const UI = require('sketch/ui');
const sketch = require('sketch');
const BrowserWindow = require('sketch-module-web-view');

export function uploadSelect(context) {
  onRun(context, false);
}
export function setting(e) {
  onRun(context, true);
}
export function uploadAll(context) {
  const url = Settings.settingForKey('url');
  const doc = context.document;

  if (!url) {
    UI.getInputFromUser(
      'Input the server address.',
      {
        initialValue: url || 'https://'
      },
      (err, value) => {
        if (err) {
          return;
        }
        return Settings.setSettingForKey('url', value);
      }
    );
    return;
  }

  const document = require('sketch/dom').getSelectedDocument();
  const options = {
    identifier: 'unique.id1',
    width: 540,
    height: 300
  };

  const artBoards = document.selectedPage.layers.filter(
    layer => layer.name === '切图' || layer.name === 'slices'
  )[0];

  if (!artBoards) {
    return doc.showMessage(
      'Select page doesn\'t include artBoard with name "切图" or slices.'
    );
  }

  const browserWindow = new BrowserWindow(options);

  const layers = artBoards.layers.map(layer => layer.name);

  browserWindow.webContents
    .executeJavaScript('sendUrl("' + url + '")')
    .then(res => {
      console.log(res);
    });

  browserWindow.webContents
    .executeJavaScript('sendLayer(' + JSON.stringify(layers) + ')')
    .then(res => {
      console.log(res);
    });

  browserWindow.webContents.on('nativeLog', function(s, id) {
    let layer = document.selectedPage.layers
      .filter(layer => layer.name === '切图')[0]
      .layers.filter(layer => layer.name === s)[0];
    if (!layer) {
      return sketch.UI.message(s + ' not found!');
    }
    const layerName = layer.name;
    const bitmap = sketch
      .export(
        [
          document.selectedPage.layers
            .filter(layer => layer.name === '切图')[0]
            .layers.filter(layer => layer.name === s)[0]
        ],
        { formats: 'png', output: false }
      )[0]
      .toString('base64');

    fetch(url + '/sketch/' + id, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: { image: bitmap, name: layerName }
    })
      .then(response => response.text())
      .then(text => {
        browserWindow.webContents
          .executeJavaScript('uploadSuccess()')
          .then(res => {
            console.log(res);
          });
      })
      .catch(e => {
        browserWindow.webContents
          .executeJavaScript('uploadFail()')
          .then(res => {
            console.log(res);
          });
      });
  });

  browserWindow.loadURL(require('./ui.html'));
}

function exportSelectAsBitmap(document, layer, scale) {
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
        return Settings.setSettingForKey('url', value);
      }
    );
    return;
  }

  const doc = context.document;
  const selection = context.selection;

  if (selection.count() == 0) {
    doc.showMessage('Please select the layer to upload.');
  } else {
    for (let i = 0; i < selection.count(); i++) {
      const layer = selection[i];
      const layerName = layer.name();
      const { bitmap } = exportSelectAsBitmap(doc, layer, 1);
      fetch(url + '/sketch/arroast', {
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
