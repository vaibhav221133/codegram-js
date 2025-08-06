// In a new utils/formatter.js file
export function formatContentWithInteractions(content, userId) { // Removed type annotations
  return content.map(item => ({
    ...item,
    isLiked: userId ? item.likes?.some((l) => l.userId === userId) : false, // Removed type annotation
    isBookmarked: userId ? item.bookmarks?.some((b) => b.userId === userId) : false, // Removed type annotation
    likesCount: item._count.likes,
    commentsCount: item._count.comments,
    bookmarksCount: item._count.bookmarks,
    likes: undefined, // Clean up response
    bookmarks: undefined,
  }));
}