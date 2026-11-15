// This runs in YouTube's MAIN world, where page-owned player data is available.
(() => {
  const getChannelId = () => {
    const player = document.querySelector('ytd-watch-flexy');
    const playerData = player?.playerResponse || player?.data?.playerResponse;
    return playerData?.videoDetails?.channelId
      || window.ytInitialPlayerResponse?.videoDetails?.channelId
      || window.ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents
        ?.find(item => item.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.navigationEndpoint
        ?.browseEndpoint?.browseId
      || null;
  };

  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.source !== 'replyflow-extension') return;
    if (event.data.type !== 'GET_CHANNEL_ID') return;
    window.postMessage({
      source: 'replyflow-page',
      type: 'CHANNEL_ID',
      requestId: event.data.requestId,
      channelId: getChannelId()
    }, location.origin);
  });
})();
