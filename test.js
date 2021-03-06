var assert = require('assert');
var connect = require('connect');
var request = require('supertest');

var compress = require('./');

var app = connect();
app.use(compress({
  threshold: 0
}));

app.use(connect.static(__dirname));

var app2 = connect();
app2.use(compress({
  threshold: '1kb'
}));

app2.use('/response/small', function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  res.end('tiny');
});

app2.use('/response/large', function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  res.end(new Buffer(2048));
});

app2.use('/stream/small/length', function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', '1');
  res.write('a');
  res.end();
});

app2.use('/stream/large/length', function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', '2048');
  res.write(new Buffer(2048));
  res.end();
});

app2.use('/stream/small', function(req, res, next){
  res.setHeader('Content-Type', 'text/plain');
  res.write('a');
  res.end();
});

app2.use('/image', function(req, res){
  res.setHeader('Content-Type', 'image/png');
  res.write(new Buffer(2048));
  res.end();
});

describe('compress()', function(){
  it('should gzip files', function(done){
    request(app)
    .get('/package.json')
    .set('Accept-Encoding', 'gzip')
    .end(function(err, res){
      res.body.should.not.equal('- groceries');
      done();
    });
  })

  it('should set Content-Encoding', function(done){
    request(app)
    .get('/package.json')
    .set('Accept-Encoding', 'gzip')
    .expect('Content-Encoding', 'gzip', done);
  })

  it('should support HEAD', function(done){
    request(app)
    .head('/package.json')
    .set('Accept-Encoding', 'gzip')
    .expect('', done);
  })

  it('should support conditional GETs', function(done){
    request(app)
    .get('/package.json')
    .set('Accept-Encoding', 'gzip')
    .end(function(err, res){
      var date = res.headers['last-modified'];
      request(app)
      .get('/package.json')
      .set('Accept-Encoding', 'gzip')
      .set('If-Modified-Since', date)
      .expect(304, done);
    });
  })

  it('should set Vary', function(done){
    request(app)
    .get('/package.json')
    .set('Accept-Encoding', 'gzip')
    .expect('Vary', 'Accept-Encoding', done);
  })

  it('should set Vary even if Accept-Encoding is not set', function(done){
    request(app)
    .get('/package.json')
    .expect('Vary', 'Accept-Encoding', done);
  })

  it('should not set Vary if Content-Type does not pass filter', function(done){
    request(app2)
    .get('/image')
    .end(function(err, res){
      res.headers.should.not.have.property('vary');
      done();
    })
  })

  it('should transfer chunked', function(done){
    request(app)
    .get('/package.json')
    .set('Accept-Encoding', 'gzip')
    .expect('Transfer-Encoding', 'chunked', done);
  })

  it('should remove Content-Length for chunked', function(done){
    request(app)
    .get('/package.json')
    .set('Accept-Encoding', 'gzip')
    .end(function(err, res){
      res.headers.should.not.have.property('content-length');
      done()
    });
  })

  describe('threshold', function(){
    it('should not compress responses below the threshold size', function(done){
      request(app2)
      .get('/response/small')
      .set('Accept-Encoding', 'gzip')
      .end(function(err, res){
        // I don't know how to do this with supertest
        // '' or 'identity' should be valid values as well,
        // but they are not set by compress.
        assert.equal(res.headers['content-encoding'], undefined);

        done()
      })
    })

    it('should compress responses above the threshold size', function(done){
      request(app2)
      .get('/response/large')
      .set('Accept-Encoding', 'gzip')
      .expect('Content-Encoding', 'gzip', done);
    })

    it('should compress when streaming without a content-length', function(done){
      request(app2)
      .get('/stream/small')
      .set('Accept-Encoding', 'gzip')
      .expect('Content-Encoding', 'gzip', done);
    })

    it('should not compress when streaming and content-length is lower than threshold', function(done){
      request(app2)
      .get('/stream/small/length')
      .set('Accept-Encoding', 'gzip')
      .end(function(err, res){
        assert.equal(res.headers['content-encoding'], undefined);

        done()
      })
    })

    it('should compress when streaming and content-length is larger than threshold', function(done){
      request(app2)
      .get('/stream/large/length')
      .set('Accept-Encoding', 'gzip')
      .expect('Content-Encoding', 'gzip', done);
    })
  })

  describe('res.flush()', function () {
    it('should always be present', function (done) {
      var app = connect();

      app.use(compress());
      app.use(function (req, res) {
        res.flush.should.be.a.Function;
        res.statusCode = 204;
        res.end();
      });

      request(app)
      .get('/')
      .expect(204, done);
    })

    // If anyone knows how to test if the flush works...
    // it('should flush the response', function (done) {

    // })
  })
})
