var page = require('webpage').create(),
  system = require('system');

var address = system.args[1],
  output = system.args[2],
  width = system.args[3] || 1920,
  height = system.args[3] || 1080;

page.viewportSize = {width: width, height: height};

page.onConsoleMessage = function (msg) {
  console.log(msg);
};

function capture() {
  page.clipRect = page.evaluate(function () {
    return document.querySelector('main').getBoundingClientRect();
  });
  page.render(output);
}

page.onPrompt = function (msg, defaultVal) {
  if (msg === 'clue_done_magic_key') {
    console.log('magic key');
    capture();
    phantom.exit();
  }
  return defaultVal;
};
console.log('open page', address);
page.open(address, function (status) {
  if (status !== 'success') {
    console.log('Unable to load the address!', address);
    phantom.exit(1);
  }
  console.log('opened');
  /*setInterval(function () {
   page.render('s' + Date.now() + '.png');
   }, 40);*/
});
