(function() {
  'use strict';

  var request = require('request'),
      miner = require('text-miner'),
      dictionary = require('levelup')(__dirname + '/dictionary');

  function ascending(a, b) {
    return a.count > b.count ?
      -1 :
      (a.count < b.count) ?
        1 : 0;
  }

  function limit(max) {
    return (term, index) => index < max;
  }

  function query(options, done) {
    if (!options.site)
      return;

    options = typeof options === 'string' ? { site: options } : options;
    options.threshold = options.threshold || 5;
    options.dictionary = options.dictionary === undefined ? true : options.dictionary;

    request(
      options.site,
      (error, response, body) => {
        if (error || response.statusCode !== 200)
          return new Error('request failed');

        var corpus = new miner.Corpus([]);
        corpus.addDoc(body.replace(/<[^>]*>/g, ''));
        corpus
          .trim()
          .toLower()
          .removeInvalidCharacters()
          .removeInterpunctuation()
          .removeNewlines()
          .removeDigits()
          .removeWords(miner.STOPWORDS.EN);

        var terms = new miner.Terms(corpus),
            freqTerms = terms.findFreqTerms(options.threshold);

        if (!options.dictionary)
          return done(
            freqTerms
              .sort(ascending)
              .filter(limit(options.limit)
            )
          );

        var words = [];
        freqTerms.forEach(
          (term, index) => {
            dictionary.get(term.word, (error, value) => {
              if (!error)
                words.push(term);

              if (index !== freqTerms.length - 1)
                return;

              options.limit = options.limit || words.length;
              words = words
                .sort(ascending)
                .filter(limit(options.limit));

              done(words);
            });
          }
        );
      }
    );
  }

  module.exports = query;
}());