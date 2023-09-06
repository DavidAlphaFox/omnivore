import { nanoid } from 'nanoid'
import { NewsletterEmail } from '../entity/newsletter_email'
import { env } from '../env'
import {
  CreateNewsletterEmailErrorCode,
  SubscriptionStatus,
} from '../generated/graphql'
import { authTrx } from '../repository'
import { userRepository } from '../repository/user'
import addressparser = require('nodemailer/lib/addressparser')

const parsedAddress = (emailAddress: string): string | undefined => {
  const res = addressparser(emailAddress, { flatten: true })
  if (!res || res.length < 1) {
    return undefined
  }
  return res[0].address
}

export const createNewsletterEmail = async (
  userId: string
): Promise<NewsletterEmail> => {
  const user = await userRepository.findOne({
    where: { id: userId },
    relations: ['profile'],
  })
  if (!user) {
    return Promise.reject({
      errorCode: CreateNewsletterEmailErrorCode.Unauthorized,
    })
  }
  // generate a random email address with username prefix
  const emailAddress = createRandomEmailAddress(user.profile.username, 8)

  return authTrx(
    (t) =>
      t.getRepository(NewsletterEmail).save({
        address: emailAddress,
        user: user,
      }),
    undefined,
    userId
  )
}

export const getNewsletterEmails = async (
  userId: string
): Promise<NewsletterEmail[]> => {
  return authTrx((t) =>
    t
      .getRepository(NewsletterEmail)
      .createQueryBuilder('newsletter_email')
      .leftJoinAndSelect('newsletter_email.user', 'user')
      .leftJoinAndSelect(
        'newsletter_email.subscriptions',
        'subscriptions',
        'subscriptions.status = :status',
        {
          status: SubscriptionStatus.Active,
        }
      )
      .where('newsletter_email.user = :userId', { userId })
      .orderBy('newsletter_email.createdAt', 'DESC')
      .getMany()
  )
}

export const deleteNewsletterEmail = async (id: string): Promise<boolean> => {
  const result = await authTrx((t) =>
    t.getRepository(NewsletterEmail).delete(id)
  )

  return !!result.affected
}

export const updateConfirmationCode = async (
  emailAddress: string,
  confirmationCode: string
): Promise<boolean> => {
  const address = parsedAddress(emailAddress)
  const result = await authTrx((t) =>
    t
      .getRepository(NewsletterEmail)
      .createQueryBuilder()
      .where('address ILIKE :address', { address })
      .update({
        confirmationCode: confirmationCode,
      })
      .execute()
  )

  return !!result.affected
}

export const getNewsletterEmail = async (
  emailAddress: string
): Promise<NewsletterEmail | null> => {
  const address = parsedAddress(emailAddress)
  return authTrx((t) =>
    t
      .getRepository(NewsletterEmail)
      .createQueryBuilder('newsletter_email')
      .innerJoinAndSelect('newsletter_email.user', 'user')
      .where('address ILIKE :address', { address })
      .getOne()
  )
}

const createRandomEmailAddress = (userName: string, length: number): string => {
  // format: hongbo-sduhfsjh1e@inbox.omnivore.app
  const inbox =
    'inbox' + (env.server.apiEnv === 'prod' ? '' : `-${env.server.apiEnv}`)
  /* nanoid can generate a random string ending with -
  which is not allowed as a last character in email address.
  So we append a 'e' to all random strings.

  when rand is sdfsdf-: jacksonh-sdfsdf-e@inbox.omnivore.app
  when rand is abcdef: jacksonh-abcdefe@inbox.omnivore.app
   */
  return `${userName}-${nanoid(length)}e@${inbox}.omnivore.app`
}
