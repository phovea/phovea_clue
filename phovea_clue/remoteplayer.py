from phovea_server import ns
from phovea_server.config import view as config_view
import memcache
import logging

__author__ = 'Samuel Gratzl'
app = ns.Namespace(__name__)
conf = config_view('phovea_clue')

mc = memcache.Client(conf.get('memcached'), debug=0)
mc_prefix = 'clue_'

_log = logging.getLogger(__name__)


def generate_url(app, prov_id, state):
  base = '{0}{1}/#clue_graph={2}&clue_state={3}&clue=P&clue_store=remote&clue_headless=Y'

  return base.format(conf.server, app,
                     prov_id,
                     state)


def generate_slide_url(app, prov_id, slide):
  base = '{0}{1}/#clue_graph={2}&clue_slide={3}&clue=P&clue_store=remote&clue_headless=Y'

  return base.format(conf.server, app,
                     prov_id,
                     slide)


@app.route('/dump/<path:page>')
def test(page):
  from selenium import webdriver

  options = webdriver.ChromeOptions()
  options.debugger_address = conf.chromeAddress
  driver = webdriver.Chrome(chrome_options=options)

  driver.implicitly_wait(20)  # wait at most 20 seconds
  _log.info('url %s', page)
  driver.get('http://' + page)
  _log.info('take screenshot')
  obj = driver.get_screenshot_as_png()
  driver.quit()
  return ns.Response(obj, mimetype='image/png')


def create_via_selenium(url, width, height):
  from selenium import webdriver

  options = webdriver.ChromeOptions()
  options.debugger_address = conf.chromeAddress
  # TODO width, height not supported in remote by default 1920x1080
  driver = webdriver.Chrome(chrome_options=options)

  driver.implicitly_wait(20)  # wait at most 20 seconds
  _log.info('url %s', url)
  driver.get(url)
  try:
    driver.find_element_by_css_selector('main')
    for entry in driver.get_log('browser'):
      _log.info(entry)
    driver.find_element_by_css_selector('body.clue_jumped')
    _log.info('found jumped flag')
    # try:
    # we have to wait for the page to refresh, the last thing that seems to be updated is the title
    # WebDriverWait(driver, 10).until(EC.title_contains("cheese!"))

    # You should see "cheese! - Google Search"
    # print driver.title

    # finally:
    #    driver.quit()
    # obj = main_elem.screenshot_as_png()
  except Exception as e:
    _log.exception('cant fullfil query %s', e)
  _log.info('take screenshot')
  obj = driver.get_screenshot_as_png()
  driver.quit()
  return obj


def _create_screenshot_impl(app, prov_id, state, format, width=1920, height=1080, force=False):
  url = generate_url(app, prov_id, state)

  key = mc_prefix + url + 'w' + str(width) + 'h' + str(height)

  obj = mc.get(key)
  if not obj or force:
    _log.info('requesting url %s', url)
    obj = create_via_selenium(url, width, height)
    mc.set(key, obj)
  return obj


def _create_preview_impl(app, prov_id, slide, format, width=1920, height=1080, force=False):
  url = generate_slide_url(app, prov_id, slide)

  key = mc_prefix + url + 'w' + str(width) + 'h' + str(height)

  obj = mc.get(key)
  if not obj or force:
    _log.debug('requesting url %s', url)
    obj = create_via_selenium(url, width, height)
    mc.set(key, obj)
  return obj


def fix_format(format):
  return 'jpeg' if format == 'jpg' else format


@app.route('/screenshot/<app>/<prov_id>/<state>.<format>')
def create_screenshot(app, prov_id, state, format):
  width = ns.request.args.get('width', 1920)
  height = ns.request.args.get('height', 1080)
  force = ns.request.args.get('force', None) is not None

  s = _create_screenshot_impl(app, prov_id, state, format, width, height, force)
  return ns.Response(s, mimetype='image/' + fix_format(format))


def to_thumbnail(s, width, format):
  import PIL.Image
  import io

  b = io.BytesIO(s)
  img = PIL.Image.open(b)

  wpercent = (width / float(img.size[0]))
  height = int(float(img.size[1]) * float(wpercent))
  img.thumbnail((width, height), PIL.Image.ANTIALIAS)

  b = io.BytesIO()
  img.save(b, fix_format(format))
  b.seek(0)
  obj = b.read()
  return obj


@app.route('/thumbnail/<app>/<prov_id>/<state>.<format>')
def create_thumbnail(app, prov_id, state, format):
  format = fix_format(format)
  width = int(ns.request.args.get('width', 128))
  force = ns.request.args.get('force', None) is not None

  url = generate_url(app, prov_id, state)

  key = mc_prefix + url + 't' + str(width)

  obj = mc.get(key)
  if not obj or force:
    s = _create_screenshot_impl(app, prov_id, state, format, force=force)
    obj = to_thumbnail(s, width, format)
    mc.set(key, obj)

  return ns.Response(obj, mimetype='image/' + format)


@app.route('/preview/<app>/<prov_id>/<slide>.<format>')
def create_preview(app, prov_id, slide, format):
  width = ns.request.args.get('width', 1920)
  height = ns.request.args.get('height', 1080)
  force = ns.request.args.get('force', None) is not None

  s = _create_preview_impl(app, prov_id, slide, format, width, height, force)
  return ns.Response(s, mimetype='image/' + fix_format(format))


@app.route('/preview_thumbnail/<app>/<prov_id>/<slide>.<format>')
def create_preview_thumbnail(app, prov_id, slide, format):
  format = fix_format(format)
  width = int(ns.request.args.get('width', 128))
  force = ns.request.args.get('force', None) is not None

  url = generate_slide_url(app, prov_id, slide)

  key = mc_prefix + url + 't' + str(width)

  obj = mc.get(key)
  if not obj or force:
    s = _create_preview_impl(app, prov_id, slide, format, force=force)
    obj = to_thumbnail(s, width, format)
    mc.set(key, obj)

  return ns.Response(obj, mimetype='image/' + format)


def create():
  """
   entry point of this plugin
  """
  app.debug = True
  return app


if __name__ == '__main__':
  app.debug = True
  app.run(host='0.0.0.0')
