// import { NextResponse } from 'next/server';

// const PUBLIC_ROOT_PATH = '/'; 
// const CHAT_PAGE_PATH = '/chat';

// export function proxy(request) {
//     const { pathname } = request.nextUrl;
    
//     console.log('--- MIDDLEWARE TRIGGERED ---');
//     console.log(`Pathname: ${pathname}`);
    
//     // Check if the user is visiting the root path
//     if (pathname === PUBLIC_ROOT_PATH) {
        
//         // 2. Read the cookie
//         const isTourSeen = request.cookies.get('isTourSeen');
        
//         console.log(`isTourSeen cookie value: ${isTourSeen}`); // <-- CHECK THIS VALUE
        
//         // 3. If the cookie is NOT present, redirect
//         if (!isTourSeen) {
//             console.log(`Redirecting to ${CHAT_PAGE_PATH}`);
//             return NextResponse.redirect(new URL(CHAT_PAGE_PATH, request.url));
//         }
//     }

//     return NextResponse.next();
// }

// export const config = {
//     // We only need to match the root path for this specific logic
//     matcher: ['/'],
// };