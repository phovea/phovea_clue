__author__ = 'Samuel Gratzl'

import flask

app = flask.Flask(__name__)

import caleydo_server.config
conf = caleydo_server.config.view('clue_demo')

import memcache
mc = memcache.Client(conf['memcached'], debug=0)
mc_prefix='clue_'

def generate_url(app, prov_id, state):
  return 'http://localhost:9000/{0}/#clue_graph={1}&clue_state={2}&clue=P&clue_store=remote&clue_headless=Y'.format(app, prov_id, state)


@app.route('/screenshot/<app>/<prov_id>/<state>.png')
def create_screenshot(app,prov_id,state):
  width = flask.request.args.get('width',1920)
  height = flask.request.args.get('height',1080)

  url = generate_url(app, prov_id,state)

  key = mc_prefix+url+'w'+str(width)+'h'+str(height)

  def gen_screenshot():
    obj = mc.get(key)
    if not obj:
      from selenium import webdriver

      driver = webdriver.PhantomJS(executable_path=conf.phantomjs2) # or add to your PATH
      driver.implicitly_wait(10)
      driver.set_window_size(width, height) # optional
      print url
      driver.get(url)
      main_elem = driver.find_element_by_css_selector('main')
      for entry in driver.get_log('browser'):
        print entry
      check = driver.find_element_by_css_selector('body.clue_jumped')
      #try:
          # we have to wait for the page to refresh, the last thing that seems to be updated is the title
          #WebDriverWait(driver, 10).until(EC.title_contains("cheese!"))

          # You should see "cheese! - Google Search"
          #print driver.title

      #finally:
      #    driver.quit()
      #obj = main_elem.screenshot_as_png()
      obj = driver.get_screenshot_as_png()
      driver.quit()
      mc.set(key, obj)
    yield obj

  return flask.Response(gen_screenshot(), mimetype='image/png')


def create():
  """
   entry point of this plugin
  """
  app.debug = True
  return app


if __name__ == '__main__':
  app.debug = True
  app.run(host='0.0.0.0')
