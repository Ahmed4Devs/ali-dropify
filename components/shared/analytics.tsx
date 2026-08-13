import Script from "next/script";

export function AnalyticsProvider() {
  const gtm = process.env.NEXT_PUBLIC_GTM_ID;
  const meta = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const tiktok = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  return (
    <>
      {gtm && <Script id="gtm" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtm)});` }} />}
      {gtm && <noscript><iframe title="Google Tag Manager" src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtm)}`} height="0" width="0" className="hidden" /></noscript>}
      {meta && <Script id="meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(meta)});fbq('track','PageView');` }} />}
      {tiktok && <Script id="tiktok-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i=d.createElement('script');i.type='text/javascript';i.async=!0;i.src='https://analytics.tiktok.com/i18n/pixel/events.js?sdkid='+e;var n=d.getElementsByTagName('script')[0];n.parentNode.insertBefore(i,n)};ttq.load(${JSON.stringify(tiktok)});ttq.page()}(window,document,'ttq');` }} />}
    </>
  );
}
