import { writeFileSync } from 'fs'
import latest from '../latest.json' assert { type: 'json' }
import { $fetch } from 'ofetch'

const skipCheck = process.env.SKIP_CHECK === 'true' ? true : false

type TwitchData = {
  "title": string,
  "tags": string[],
  "viewer_count": number
  "started_at": string // ISO Date
  "thumbnail_url": string
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || ''
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || ''
const TWITCH_USER_NAME = 'thealexlichter'

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  console.error('Missing Twitch Client ID or Secret')
  console.error('TWITCH_CLIENT_ID: ', TWITCH_CLIENT_ID.length ? 'set' : 'not set')
  console.error('TWITCH_CLIENT_SECRET: ', TWITCH_CLIENT_SECRET.length ? 'set' : 'not set')
  process.exit(1)
}

run().catch((e) => {
  console.log('Unknown error :(')
  console.error(e)
  process.exit(1)
})


async function run() {
  // get the access token via client id + secret
  const accessToken = await getAccessToken(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)
  // get the data for the stream
  const rawStreamData = await getStreamData(TWITCH_CLIENT_ID, accessToken)
  const data = rawStreamData ?? {}
  const stringifiedData = JSON.stringify(data)

  const didChange = stringifiedData !== latest

  if(skipCheck) {
    console.log('Skipping check')
    console.log('new data is ', stringifiedData)
    return
  }

  if (!didChange) {
    return
  }

  console.log('Latest data: ', latest)
  console.log('New data: ', stringifiedData)

  writeNewData(stringifiedData)

// compare current and latest
// override latest if changed
// commit changes <- done by github action 
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new FormData()
  body.append('client_id', clientId)
  body.append('client_secret', clientSecret)
  body.append('grant_type', 'client_credentials')

  try {
    const result = await $fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body
    })

    return result.access_token
  } catch (e) {
    console.error('Error getting access token')
    console.error(e)
    process.exit(1)
  }
}

async function getStreamData(clientId: string, accessToken: string): Promise<TwitchData | undefined> {
  try {
    const result = await $fetch('https://api.twitch.tv/helix/streams', {
      query: {
        user_login: TWITCH_USER_NAME
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId
      }
    })

    if (!result.data.length) {
      return undefined
    }
    const [stream] = result.data
    const { title, tags, viewer_count, started_at, thumbnail_url } = stream
    return {
      title,
      tags,
      viewer_count,
      started_at,
      thumbnail_url
    }
  } catch (e) {
    console.error('Error getting stream data')
    console.error(e)
    process.exit(1)
  }
}

function writeNewData(content: string) {
  writeFileSync('./latest.json', content)
}