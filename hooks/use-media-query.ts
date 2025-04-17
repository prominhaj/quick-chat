"use client"

import { useEffect, useState } from "react"

export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const media = window.matchMedia(query)

        // Set initial value
        setMatches(media.matches)

        // Update matches when media query changes
        const listener = () => setMatches(media.matches)
        media.addEventListener("change", listener)

        return () => media.removeEventListener("change", listener)
    }, [query])

    return matches
}
