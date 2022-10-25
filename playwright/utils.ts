import 'dotenv/config';

import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { installGlobals } from '@remix-run/node';
import { parse } from 'cookie';

import {
  createUserSession,
  USER_AUTHENTICATION_SESSION_NAME,
} from '~/features/user-authentication/user-authentication-session.server';

installGlobals();

/**
 * Generates a random decentralized identity token (DID). This function is to
 * _**generate fake test data only**_. We use DIDs for user ids.
 *
 * @see https://magic.link/docs/introduction/decentralized-id
 *
 * @returns did - Decentralized identity token.
 */
function generateRandomDid() {
  return 'did:ethr:' + faker.finance.ethereumAddress();
}

/**
 * Adds a cookie to the page's browser context to log the user with the given id
 * in.
 *
 * @param options - The id of the user to log in and and the test's page.
 */
export async function loginByCookie({
  id = generateRandomDid(),
  page,
}: {
  id?: string;
  page: Page;
}) {
  const response = await createUserSession({
    redirectTo: '/',
    remember: false,
    request: new Request('http://localhost:3000/'),
    userId: id,
  });
  const cookieValue = response.headers.get('Set-Cookie');

  if (!cookieValue) {
    throw new Error('Cookie missing from createUserSession response');
  }

  const parsedCookie = parse(cookieValue);
  const token = parsedCookie[USER_AUTHENTICATION_SESSION_NAME];
  await page.context().addCookies([
    {
      name: USER_AUTHENTICATION_SESSION_NAME,
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);
}