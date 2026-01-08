import Script from 'next/script'

interface TrackingScriptsProps {
  facebookPixelId?: string | null
  googleAnalyticsId?: string | null
  googleTagManagerId?: string | null
  googleAdsId?: string | null
  tiktokPixelId?: string | null
  customHeaderScripts?: string | null
}

export function TrackingScripts({
  facebookPixelId,
  googleAnalyticsId,
  googleTagManagerId,
  googleAdsId,
  tiktokPixelId,
  customHeaderScripts,
}: TrackingScriptsProps) {
  return (
    <>
      {/* Google Tag Manager - Should be first */}
      {googleTagManagerId && (
        <>
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${googleTagManagerId}');
              `,
            }}
          />
        </>
      )}

      {/* Google Analytics 4 */}
      {googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `,
            }}
          />
        </>
      )}

      {/* Google Ads */}
      {googleAdsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="google-ads-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAdsId}');
              `,
            }}
          />
        </>
      )}

      {/* Meta (Facebook) Pixel */}
      {facebookPixelId && (
        <Script
          id="fb-pixel-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${facebookPixelId}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}

      {/* TikTok Pixel */}
      {tiktokPixelId && (
        <Script
          id="tiktok-pixel-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('${tiktokPixelId}');
                ttq.page();
              }(window, document, 'ttq');
            `,
          }}
        />
      )}

      {/* Custom Header Scripts */}
      {customHeaderScripts && (
        <Script
          id="custom-scripts"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: customHeaderScripts
              // Remove script tags as Next.js Script component handles that
              .replace(/<script[^>]*>/gi, '')
              .replace(/<\/script>/gi, ''),
          }}
        />
      )}
    </>
  )
}

// Noscript fallback for GTM (to be placed in body)
export function GTMNoscript({ googleTagManagerId }: { googleTagManagerId?: string | null }) {
  if (!googleTagManagerId) return null

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  )
}
