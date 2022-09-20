const express = require('express')
const cors = require('cors')
const axios = require('axios')
const hltb = require('howlongtobeat')

require('dotenv').config()

const app = express()
const hltbService = new hltb.HowLongToBeatService()


app.use(cors())
app.use(express.json()) // Deprecated - Kept for now to prevent breaking previous versions. Use GET instead.

let token
let expirationDate

const check_token = (req, res, next) => {
    const token = req.headers['authorization']?.split('Bearer')[1].trim()
    if (token === process.env.TOKEN) next()
    else res.sendStatus(401)
}

const twitch_token = async () => {
    if (!expirationDate || expirationDate <= new Date()) {
        const {data} = await axios.post(
            `https://id.twitch.tv/oauth2/token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=client_credentials`
        )
        token = data.access_token
        expirationDate = new Date(new Date().getTime() + data.expires_in * 1000)
        console.log('GET TOKEN')
    }
}

app.get('/', ({res}) => {
    res.redirect('https://game-queue.com')
})

// Deprecated - Kept for now to prevent breaking previous versions. Use GET instead.
app.get('/igdb', check_token, async (req, res) => {
    try {
        let query = `fields name, first_release_date, platforms.platform_logo.url, cover.url, total_rating, game_modes.name, summary, 
    genres.name, involved_companies.company.name, platforms.name, screenshots.url, similar_games.name, 
    similar_games.cover.url, themes.name, url;
    sort first_release_date desc;
    where rating >= 80;
    where total_rating_count > 10;`

        const search = req.query?.search?.trim().replace(/\W/gim, ' ')
        if (search) {
            query = `fields name, first_release_date, platforms.platform_logo.url, cover.url, total_rating, game_modes.name, summary, 
      genres.name, involved_companies.company.name, platforms.name, screenshots.url, similar_games.name, 
      similar_games.cover.url, themes.name, url;
      search "${search}";
      where version_parent = null;`
        }

        const id = +req.query?.id
        if (!isNaN(id)) {

            query = `fields name, first_release_date, platforms.platform_logo.url, cover.url, total_rating, game_modes.name, summary, 
      genres.name, involved_companies.company.name, platforms.name, screenshots.url, similar_games.name, 
      similar_games.cover.url, themes.name, url;
      where id=${id};`
        }

        await twitch_token()
        const {data} = await axios.post(
            'https://api.igdb.com/v4/games',
            query,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Client-ID': process.env.CLIENT_ID,
                    'Content-Type': 'text/plain'
                }
            }
        )
        res.json(data)

    } catch (err) {
        console.error(err)
        res.sendStatus(500)
    }
})

app.get('/games', check_token, async (req, res) => {
    try {

        let query = `fields name, first_release_date, platforms.abbreviation, cover.url, total_rating;
    where rating > 69 &
    aggregated_rating_count > 0 &
    total_rating_count > 1 &
    version_parent = null;
    sort first_release_date desc;`

        const search = req.query?.q?.trim().replace(/\W/gim, ' ')
        if (search) {
            query = `fields name, first_release_date, platforms.abbreviation, cover.url, total_rating;
      search "${search}";
      where version_parent = null;`
        }

        const id = +req.query?.id
        if (!isNaN(id)) {

            query = `fields name, first_release_date, cover.url, total_rating, game_modes.name, summary, 
      genres.name, involved_companies.company.name, platforms.name, screenshots.url, similar_games.name, 
      similar_games.cover.url, themes.name, multiplayer_modes.*, url;
      where id=${id};`
        }

        await twitch_token()
        const {data} = await axios.post(
            'https://api.igdb.com/v4/games',
            query,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Client-ID': process.env.CLIENT_ID,
                    'Content-Type': 'text/plain'
                }
            }
        )
        res.json(data)

    } catch (err) {
        console.error(err)
        res.sendStatus(500)
    }
})

app.get('/opencritic', check_token, async (req, res) => {
    try {
        const name = req.query?.name

        if (name) {
            const {id, dist} = await axios
                .get(
                    `https://opencritic-api.p.rapidapi.com/game/search?criteria=${encodeURIComponent(name)}`,
                    {

                        headers: {
                            'X-RapidAPI-Key': process.env.RAPID_KEY,
                            'X-RapidAPI-Host': process.env.RAPID_HOST
                        }
                    }
                )
                .then(res => res.data[0])

            if (id && dist <= 0.4) {
                const data = await axios
                    .get(`https://opencritic-api.p.rapidapi.com//game/${id}`, {
                        headers: {
                            'X-RapidAPI-Key': process.env.RAPID_KEY,
                            'X-RapidAPI-Host': process.env.RAPID_HOST
                        }
                    })
                    .then(res => res.data)
                res.json(data)
                return
            }
        }

        res.sendStatus(404)
    } catch (err) {
        console.error(err)
        res.sendStatus(500)
    }
})

app.get('/howlongtobeat', check_token, async (req, res) => {
    try {
        const name = req.query?.name

        if (name) {
            const data = await hltbService.search(name).then(res => res[0])
            console.log(name, data)

            if (data.similarity >= 0.75) {
                res.json(data)
                return
            }
        }

        res.sendStatus(404)
    } catch (err) {
        console.error(err)
        res.sendStatus(500)
    }
})

app.listen(process.env.PORT || 3030, () => {
    console.log(`Server running`);
})
