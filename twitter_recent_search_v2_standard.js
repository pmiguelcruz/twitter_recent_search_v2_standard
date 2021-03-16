/** Using recent search on Twitter API V2 standard
    The recent search only returns Tweets in the last 7 days, but there's no limit on how many tweets can be returned
    The standard license doesn't enable to only put a request for tweets with geo information,
        therefore we have to collect all the tweets and only keep those that have geo information,
        geo information can be hard to get: less than 1% of tweets, but given the sheer volume of data many can be found

This script uses node.js
--  Install mac os package manager Brew: https://brew.sh
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

--  Install node: 'brew install node'
--  Install node module 'needle': 'npm install needle'
--  Install Microsoft Visual Studio Code https://code.visualstudio.com
--  Open this folder there
--  Open the embeded Terminal in Visual Studio and run the program with 'node twitter_recent_search_v2_standard.js'

*/


const needle = require('needle'); // requires library to make HTTP requests
const fs = require('fs'); // requires library to save files 
const token = "AAAAAAAAAAAAAAAAAAAAAE1pNgEAAAAA3CnuTZ4Hb5gXABQYWKabsc68HdA%3DDutKGhEb41rxWnsGRo9I9pPWTej6aXiBhYVL1GWprrvjiGkHl3"; // this is your bearer token

const endpointUrl = "https://api.twitter.com/2/tweets/search/recent"; // End-point for recent search
//const endpointUrl = "https://api.twitter.com/2/tweets/search/all"; // This would be the end-point for the full historical search, only available for academic licenses


/** This function simply puts a request given a certain 'query' 
 *  and a batch of paginated results indicated in 'nextToken' */

async function getRequest(query, nextToken) {

    // builds a query object to send
    function buildQuery() {
        let q = {
            "query": query,     // the query
            "max_results": 100, // max results per request, 100 is the maximum for standard licenses in sandboxed environments 
            "expansions": "geo.place_id",   // whenever a tweet has geographical information in the form a of place_id, get more info on that place_id
            "tweet.fields": "author_id,created_at,geo",     // by default the Tweet id and and the text are returned, but here we're also including the author_id, the time of publishing, and its geographical features
            "place.fields": "geo,name,full_name,place_type" // the additional information associated with a place_id, namely its name and a geo object with geographical coordinates, either in the form of a point or a bounding box
        };
        // the nextToken paramenter is optional (as there is none in the first request
        // but if a nextToken was passed, then it inserts it into the query object
        if(nextToken !== undefined) q["next_token"] = nextToken;
        return q;
    }

    const response = await needle('get', endpointUrl, buildQuery(), {
        headers: {
            "User-Agent": "v2RecentSearchJS",   // Can be whatver you want
            "authorization": "Bearer "+token    // Attaches your Bearer token to the header of the request
        }
    })
    return response.body;   // Returns the contents of the response
}


/** async funtions enable us to stop the program to wait on requests
 *  this function is the core of the program and where execution starts */

(async function(){

    /** an anonymous function that gets a whole batch of tweet reponses
     *  and only adds the ones with geo information to 'array' */
    function filterTweets(array, batch){
        batch.data.forEach(tweet => {
            if(tweet["geo"] !== undefined){
                /* expands place_id */
                if(tweet.geo["place_id"] !== undefined){
                    /* associates the place_id with the expanded information on place_ids in the response */
                    let expanded_geo = batch.includes.places.find( place => {
                        return place.id == tweet.geo.place_id;
                    });
                    // adds new variable to tweet object called 'place_info'
                    tweet.place_info = expanded_geo;
                }
                array.push(tweet);
            }
        });

    }

    let filteredTweets = []; //array to keep all collected tweets

    const query = "cats -is:retweet";       // we are searching for the word 'cats' but only in tweets that are *not* retweets since retweets never have geo information
    let response = await getRequest(query); // finally, put the request and wait for the response
    //console.log(response); // DEBUG
    const nGeoTweets = 500;     // after how many collected tweets with geo info are stopping execution>
    while(response.meta["next_token"] !== undefined){
        response = await getRequest(query, response.meta.next_token);
        filterTweets(filteredTweets, response);
        console.log(filteredTweets.length); // DEBUG
        await sleep(2100);  /*  sleeps the program for 2.1seconds : 
                                the standard rate limit is 450 requests per 15 min time period.
                                If you make more than 450 requests in less than 15 mins, the API
                                will block further requests until the 15 mins period is over;
                                Since the percentage of tweets with geo information is low you will 
                                need to place more than 450 requets (remember that each requests returns 100 tweets)
                                In order to stay under the rate limit and leave the program executing in the
                                background collecting tweets, only one request every 2 seconds should be placed */

        //  if we have enough tweets, stops collecting                        
        if(filteredTweets.length >= nGeoTweets) break;

    }

    console.log("TWEETS WITH GEO: " +filteredTweets.length); // DEBUG
    console.log(filteredTweets); // DEBUG
    fs.writeFileSync("out.json", JSON.stringify(filteredTweets)); // Save the results to a file in the disk
    process.exit(); // terminates the program
})();

/** Utility function that sleeps the program for 'ms' milliseconds */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

