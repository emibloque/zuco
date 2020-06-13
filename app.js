import * as http from 'http'
import * as https from 'https'
import * as url from 'url'
import sharp from 'sharp'


const BASE_URL = process.env.BASE_URL
const PORT = process.env.PORT || 3000

const requestHandler = async (request, response) => {
  console.log(request.url)
  const { w, h } = url.parse(request.url, true).query
  const width = parseInt(w)
  const height = parseInt(h)

  https.get(`${BASE_URL}${request.url}`, { enconding: null }, (res) => {
    const { statusCode, headers } = res
    const contentType = headers['content-type']
    response.writeHead(statusCode, { 'Content-Type': contentType })

    try {
      let pipeline = res
      if (w || h) {
        const options = {
          fit: sharp.fit.cover,
          withoutEnlargement: true,
          position: sharp.strategy.attention
        }

        if (!isNaN(width) && width > 0) {
          options.width = width
        }

        if (!isNaN(height) && height > 0) {
          options.height = height
        }

        const transformer = sharp().resize(options)

        pipeline = res.pipe(transformer).on('error', console.log)
      }

      pipeline.pipe(response)
    } catch (e) {
      console.error(e)
      response.end('Something went wrong')
    }

  }).on('error', (e) => {
    response.end(`Got error: ${e.message}`)
  })
}

http
  .createServer(requestHandler)
  .listen(PORT, (err) => {
    if (err) {
      return console.log('Something went wrong', err)
    }

    console.log(`Server listening on: ${PORT}`)
  })
