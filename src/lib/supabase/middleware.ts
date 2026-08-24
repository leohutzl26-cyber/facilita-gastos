import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const role = user?.user_metadata?.role;
    const path = request.nextUrl.pathname;

    // 1. Unauthenticated Routing
    if (!user) {
        if (path.startsWith('/admin') && path !== '/admin/login') {
            const url = request.nextUrl.clone();
            url.pathname = '/admin/login';
            return NextResponse.redirect(url);
        }
        if (path.startsWith('/worker') && path !== '/worker/login' && path !== '/worker/change-password') {
            const url = request.nextUrl.clone();
            url.pathname = '/worker/login';
            return NextResponse.redirect(url);
        }
    } else {
        // 2. Authenticated Role-Based Routing

        // Block suspended users
        if (user.user_metadata?.is_suspended === true) {
            // Allow them to be on the login page to see the error, but nowhere else
            if (path !== '/worker/login' && path !== '/admin/login') {
                const url = request.nextUrl.clone();
                url.pathname = '/worker/login';
                return NextResponse.redirect(url);
            }
        }

        const canViewAdminPanel = role === 'admin' || role === 'revisor';

        if (path.startsWith('/admin') && path !== '/admin/login') {
            if (!canViewAdminPanel) {
                // Workers trying to access admin
                const url = request.nextUrl.clone();
                url.pathname = '/worker/capture';
                return NextResponse.redirect(url);
            }
        }

        // Prevent logged in users from seeing login pages
        if (path === '/admin/login' || path === '/worker/login' || path === '/') {
            const url = request.nextUrl.clone();
            url.pathname = canViewAdminPanel ? '/admin/dashboard' : '/worker/capture';
            return NextResponse.redirect(url);
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
    // creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}
