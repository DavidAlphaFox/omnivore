import * as httpContext from 'express-http-context2'
import { readFileSync } from 'fs'
import path from 'path'
import { DeepPartial, EntityManager } from 'typeorm'
import { LibraryItem, LibraryItemType } from '../entity/library_item'
import { authTrx, entityManager } from '../repository'
import { libraryItemRepository } from '../repository/library_item'
import { generateSlug, stringToHash } from '../utils/helpers'
import { logger } from '../utils/logger'
import { createLibraryItem } from './library_item'

type PopularRead = {
  url: string
  title: string
  author: string
  description: string
  previewImage?: string
  publishedAt: Date
  siteName: string

  content: string
  originalHtml: string
}

const popularRead = (key: string): PopularRead | undefined => {
  const metadata = popularReads.find((pr) => pr.key === key)
  if (!metadata) {
    return undefined
  }

  try {
    const content = readFileSync(
      path.resolve(__dirname, `popular_reads/${key}-content.html`),
      'utf8'
    )
    const originalHtml = readFileSync(
      path.resolve(__dirname, `./popular_reads/${key}-original.html`),
      'utf8'
    )
    if (!content || !originalHtml) {
      return undefined
    }

    return {
      ...metadata,
      content,
      originalHtml,
    }
  } catch (e) {
    logger.info('error adding popular read', e)
    return undefined
  }
}

const popularReadToLibraryItem = (
  name: string,
  userId: string
): DeepPartial<LibraryItem> | null => {
  const pr = popularRead(name)
  if (!pr) {
    return null
  }

  return {
    slug: generateSlug(pr.title),
    readableContent: pr.content,
    originalContent: pr.originalHtml,
    description: pr.description,
    title: pr.title,
    author: pr.author,
    originalUrl: pr.url,
    itemType: LibraryItemType.Article,
    textContentHash: stringToHash(pr.content),
    thumbnail: pr.previewImage,
    publishedAt: pr.publishedAt,
    siteName: pr.siteName,
    user: { id: userId },
  }
}

export const addPopularRead = async (userId: string, name: string) => {
  const itemToSave = popularReadToLibraryItem(name, userId)
  if (!itemToSave) {
    return null
  }

  return createLibraryItem(itemToSave, userId)
}

const addPopularReads = async (
  names: string[],
  userId: string,
  entityManager: EntityManager
) => {
  const libraryItems = names
    .map((name) => popularReadToLibraryItem(name, userId))
    .filter((pr) => pr !== null) as DeepPartial<LibraryItem>[]

  return authTrx(
    async (tx) => tx.withRepository(libraryItemRepository).save(libraryItems),
    entityManager,
    userId
  )
}

export const addPopularReadsForNewUser = async (
  userId: string,
  em = entityManager
): Promise<void> => {
  const defaultReads = ['omnivore_organize', 'power_read_it_later']

  // get client from request context
  const client = httpContext.get<string>('client')

  switch (client) {
    case 'web':
      defaultReads.push('omnivore_web')
      break
    case 'ios':
      defaultReads.push('omnivore_ios')
      break
    case 'android':
      defaultReads.push('omnivore_android')
      break
  }

  // We always want this to be the top-most article in the user's
  // list. So we save it last to have the greatest saved_at
  defaultReads.push('omnivore_get_started')
  await addPopularReads(defaultReads, userId, em)
}

const popularReads = [
  {
    key: 'omnivore_get_started',
    url: 'https://blog.omnivore.app/p/getting-started-with-omnivore',
    title: 'Getting Started with Omnivore',
    author: 'The Omnivore Team',
    description: 'Get the most out of Omnivore by learning how to use it.',
    previewImage:
      'https://proxy-prod.omnivore-image-cache.app/320x320,sxQnqya1QNApB7ZAGPj9K20AU6sw0UAnjmAIy2ub8hUU/https://substackcdn.com/image/fetch/w_1200,h_600,c_fill,f_jpg,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F658efff4-341a-4720-8cf6-9b2bdbedfaa7_800x668.gif',
    publishedAt: new Date('2021-10-13'),
    siteName: 'Omnivore Blog',
  },
  {
    key: 'omnivore_ios',
    url: 'https://blog.omnivore.app/p/saving-links-from-your-iphone-or',
    title: 'Saving Links from Your iPhone or iPad',
    author: 'Omnivore',
    description: 'Learn how to save articles on iOS.',
    previewImage:
      'https://proxy-prod.omnivore-image-cache.app/320x320,sWDfv7sARTIdAlx6Rw_6t-QwL3T9aniEJRa1-jVaglNg/https://substackcdn.com/image/youtube/w_728,c_limit/k6RkIqepAig',
    publishedAt: new Date('2021-10-19'),
    siteName: 'Omnivore Blog',
  },
  {
    key: 'omnivore_organize',
    url: 'https://blog.omnivore.app/p/organize-your-omnivore-library-with',
    title: 'Organize your Omnivore library with labels',
    author: 'The Omnivore Team',
    description: 'Use labels to organize your Omnivore library.',
    previewImage:
      'https://proxy-prod.omnivore-image-cache.app/320x320,sTgJ5Q0XIg_EHdmPWcxtXFmkjn8T6hkJt7S9ziClagYo/https://substackcdn.com/image/fetch/w_1200,h_600,c_fill,f_jpg,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fdaf07af7-5cdb-4ecc-aace-1a46de3e9c58_1827x1090.png',
    publishedAt: new Date('2022-04-18'),
    siteName: 'Omnivore Blog',
  },
  {
    key: 'rlove_carnitas',
    url: 'https://medium.com/@rlove/carnitas-ff0ef1044ae9',
    title: 'Slow-Braised Carnitas Recipe',
    author: 'Robert Love',
    description:
      'Carnitas is a wonderful Mexican dish, pork shoulder cooked until tender and then given a great crisp. In Mexico, carnitas is eaten on its own, in tacos, or in tortas. This is not an authentic recipe.',
    previewImage:
      'https://proxy-prod.omnivore-image-cache.app/88x88,sIcDXt3Ar0baKG1e1Yi1e2VUZFL85xPlOeEfAxF-s-Nw/https://miro.medium.com/max/1200/1*Wl-dMBJpSgPUxUOnPQthyg.jpeg',
    publishedAt: new Date('2017-02-24'),
    siteName: '@rlove',
  },
  {
    key: 'power_read_it_later',
    url: 'https://fortelabs.co/blog/the-secret-power-of-read-it-later-apps',
    title: 'The Secret Power of ‘Read It Later’ Apps',
    author: 'Tiago Forte',
    description:
      'At the end of 2014 I received an email informing me that I had read over a million words in the ‘read it later’ app Pocket',
    previewImage:
      'https://proxy-prod.omnivore-image-cache.app/320x320,sGN5R34M5z068QMXDZD32CQD6mCbxc47hWXm__JVUePE/https://fortelabs.com/wp-content/uploads/2015/11/1rPXwIczUJRCE54v8FfAHGw.jpeg',
    publishedAt: new Date('2022-01-24'),
    siteName: 'Forte Labs',
  },
  {
    key: 'elad_meetings',
    url: 'http://blog.eladgil.com/2018/07/meeting-etiquette.html',
    title: 'Better Meetings',
    author: 'Elad Gil',
    description: 'How to make meetings more productive.',
    publishedAt: new Date('2018-07-02'),
    siteName: 'Elad Blog',
  },
  {
    key: 'jonbo_digital_tools',
    url: 'https://jon.bo/posts/digital-tools/',
    title: 'Digital Tools I Wish Existed',
    author: 'Jonathan Borichevskiy',
    description: `My digital life in a nutshell: I discover relevant content I don’t have time to consume...`,
    publishedAt: new Date('2019-11-28'),
    siteName: 'JON.BO',
  },
]
