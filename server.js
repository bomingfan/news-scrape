var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require('express-handlebars');

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;

// Initialize Express
var app = express();

// Configure middleware
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// By default mongoose uses callbacks for async queries, we're setting it to use promises (.then syntax) instead
// Connect to the Mongo DB
mongoose.Promise = Promise;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useMongoClient: true
  });
} else {
  mongoose.connect("mongodb://localhost/newsDB", {
    useMongoClient: true
  });
}


// Routes

// A GET route for scraping the echojs website
app.get("/scrape", function (req, res) {
  var resultsArray = [];
  // First, we grab the body of the html with request
  axios.get("https://techcrunch.com/popular/").then(function (response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // Now, we grab every h2 within an article tag, and do the following:
    $(".block-content").each(function (i, element) {
      // Save an empty result object
      var result = {};
      $(this).children("p.excerpt").children("a").remove();
      // Add the text and href of every link, and save them as properties of the result object
      result.index = $(this)
        .parent("div")
        .parent("li")
        .attr("id");
      result.title = $(this)
        .children("h2")
        .text();
      result.summary = $(this)
        .children("p.excerpt")
        .text();
      result.link = $(this)
        .children("h2")
        .children("a")
        .attr("href");

      resultsArray.push(result);
    });


    res.render("news", { news: resultsArray });
    // db.Article.insertMany(resultsArray)
    // .then(function(dbArticle) {
    //   // View the added result in the console
    //   return res.json(dbArticle);
    // })
    // .catch(function(err) {
    //   // If an error occurred, send it to the client
    //   return res.status(400).json(err);
    // });
  });
});

// Route for Homepage
app.get("/", function (req, res) {
  // render home page.
  res.render("index");
});

// Route for About Page
app.get("/about", function (req, res) {
  // render about page.
  res.render("about");
});


// Route for getting all Articles from the db

app.get("/articles", function (req, res) {
  // Grab every document in the Articles collection
  db.Article.find({}).sort({_id: -1})
    .then(function (dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.render("savednews", { news: dbArticle });
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving an article
app.post("/articles/:id", function (req, res) {
  db.Article.create(req.body)
    .then(function (dbArticle) {
      return res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
})

// delete an article
app.delete("/articles/delete/:id", function(req, res) {
  db.Article.findByIdAndRemove(req.params.id)
  .then(function(data){
    res.json(data);
  })
  .catch(function (err){
    res.json(err);
  })
})

// delete a note
app.delete("/notes/delete/:id", function(req, res) {
  db.Note.findByIdAndRemove(req.params.id)
  .then(function(data){
    res,json(data);
  })
  .catch(function (err){
    res.json(err);
  })
})



app.get("/notes/:id", function(req, res) {
  db.Article.findById(req.params.id)
  .populate("notes")
  .then(function(dbArticle){
    res.render("notes", {notes: dbArticle});
  })
  .catch(function(err){
    res.json(err);
  })
})


// Route for saving/updating an Article's associated Note
app.post("/notes/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({_id: req.params.id }, {$push: { notes: dbNote._id }}, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.redirect('back');
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});
