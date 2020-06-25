require('dotenv').config();
import restify from 'restify';
import { search, prepareIndex } from './search';

prepareIndex();

const server = restify.createServer();
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser({ mapParams: false }));

server.get('/api/:queryType', async (req, res, next) => {
  try {
    const queryType = escape(req.params.queryType);
    if (queryType !== 'predicate' && queryType !== 'type')
      throw Error('Search term not defined');
    const searchQuery = escape(req.query.search);
    if (!searchQuery) throw Error('Search term not defined');

    const searchRes = await search(queryType, searchQuery);
    res.send(searchRes);
  } catch (e) {
    console.error('error: ', e.message);
    res.send(500, `error: ${e}`);
  }
  next();
});

server.listen(5050, () => {
  console.log('%s listening at %s', server.name, server.url);
});
