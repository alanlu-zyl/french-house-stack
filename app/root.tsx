import './styles/sonner.css';

import { ClerkApp } from '@clerk/remix';
import { rootAuthLoader } from '@clerk/remix/ssr.server';
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  isRouteErrorResponse as getIsRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  ShouldRevalidateFunctionArgs,
  useRouteError,
  useRouteLoaderData,
} from '@remix-run/react';
import { withSentry } from '@sentry/remix';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import darkStyles from '~/styles/dark.css?url';
import styles from '~/styles/tailwind.css?url';

import { GeneralErrorBoundary } from './components/general-error-boundary';
import { Toaster } from './components/ui/sonner';
import type { EnvironmentVariables } from './entry.client';
import { i18next } from './features/localization/i18next.server';
import { NotFoundComponent } from './features/not-found/not-found-component';
import { useToast } from './hooks/use-toast';
import { enforceHttps } from './https';
import { combineHeaders } from './utils/combine-headers.server';
import type { Toast } from './utils/toast.server';
import { getToast } from './utils/toast.server';

export const handle = { i18n: 'common' };

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  {
    rel: 'stylesheet',
    href: darkStyles,
    media: '(prefers-color-scheme: dark)',
  },
  { rel: 'icon', href: '/favicons/favicon.ico' },
  {
    rel: 'alternate icon',
    type: 'image/png',
    href: '/favicons/favicon-32x32.png',
  },
  { rel: 'apple-touch-icon', href: '/favicons/apple-touch-icon.png' },
  {
    rel: 'manifest',
    href: '/favicons/site.webmanifest',
    crossOrigin: 'use-credentials',
  },
  { rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' },
];

type LoaderData = {
  ENV: EnvironmentVariables;
  locale: string;
  title: string;
  toast: Toast | null;
};

/**
 * By enabling single fetch, the loaders will no longer revalidate the data when the action status is in the 4xx range.
 * This behavior will prevent toasts from being displayed for failed actions.
 * so, we opt in to revalidate the root loader data when the action status is in the 4xx range.
 */
export const shouldRevalidate = ({
  defaultShouldRevalidate,
  actionStatus,
}: ShouldRevalidateFunctionArgs) => {
  if (actionStatus && actionStatus > 399 && actionStatus < 500) {
    return true;
  }

  return defaultShouldRevalidate;
};

const rootLoader = async ({ request }: LoaderFunctionArgs) => {
  const { NODE_ENV, SENTRY_DSN } = process.env;

  if ((NODE_ENV || 'production') === 'production') {
    enforceHttps(request);
  }

  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(request);
  const title = t('app-name');
  const { toast, headers: toastHeaders } = await getToast(request);

  return json<LoaderData>(
    {
      ENV: { ENVIRONMENT: NODE_ENV, SENTRY_DSN },
      locale,
      title,
      toast,
    },
    { headers: combineHeaders(toastHeaders) },
  );
};

export const loader = (arguments_: LoaderFunctionArgs) => {
  return rootAuthLoader(arguments_, rootLoader);
};

export const meta: MetaFunction<typeof loader> = ({
  data = { title: 'French House Stack' },
}) => [{ title: data.title }];

function useChangeLanguage(locale: string) {
  const { i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale, i18n]);
}

function App() {
  return <Outlet />;
}

export function Layout({ children }: { children: ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const { i18n } = useTranslation();
  const locale = data?.locale || 'en';
  useChangeLanguage(locale);
  useToast(data?.toast);

  const error = useRouteError();
  const isRouteErrorResponse = getIsRouteErrorResponse(error);
  const title = `${
    isRouteErrorResponse ? `${error.status} ${error.statusText}` : 'Oh no!'
  } | French House Stack`;

  return (
    <html lang={locale} className="h-full" dir={i18n.dir()}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {!!error && <title>{title}</title>}
        <Meta />
        <Links />
      </head>

      <body className="h-full overscroll-none">
        {children}
        <Toaster position="bottom-right" />
        <Scripts />
        <ScrollRestoration />
        {data?.ENV && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.ENV = ${JSON.stringify(data?.ENV)}`,
            }}
          />
        )}
      </body>
    </html>
  );
}

export default withSentry(ClerkApp(App));

export function ErrorBoundary() {
  const error = useRouteError();
  const isRouteErrorResponse = getIsRouteErrorResponse(error);

  return isRouteErrorResponse && error.status === 404 ? (
    <NotFoundComponent />
  ) : (
    <GeneralErrorBoundary />
  );
}
