Design & Visuals

I stuck to a semantic colour system—Green, Amber, Red—managed through a central colour constant. This keeps the UI predictable and makes it easy to tweak the thresholds later if needed.

For the data visualization, I went with two specific views:

Bar Chart: Best for side-by-side comparisons of different elements.

Radar Chart: Great for showing the "shape" of someone's performance and highlighting specific gaps across dimensions.

Both are built using Recharts and wrapped in responsive containers so they don't break on smaller screens.

Key UX Improvements
Perceived Performance: Instead of a jarring load spinner, I built skeleton screens with a shimmer effect. It makes it feel faster because the user can see the layout before the data even hits.

Deep Dives: I added filtering (by status/reflection) and sorting (by score) using useMemo to keep the UI snappy.

Inline Context: Rather than using messy modals, I implemented expandable rows for question details. You can see the specific answer and score breakdown without losing your place in the list.

Resilience: I added a proper error state with a retry trigger. If the API call fails, the user isn't stuck; they can just hit "Retry" to kick off the fetch again.

Utility: I included a quick Export feature (JSON download and a "Copy to Clipboard" button) to make the data portable.

Technical Choices & Challenges
1 The "No Library" Animation Trick
I wanted the progress bars to feel fluid, but I didn't want to bloat the bundle with a heavy motion library. I used a setTimeout hook to trigger CSS transitions on mount—simple, lightweight, and effective.

2 Handling Missing Data
The current API contract didn't originally include question_responses. To keep the "Questions" tab functional for this demo, I updated the types and built a generateMockQuestions() fallback. This ensures the UI is ready to go once the backend catches up.

3 Responsive Layout
I went with a CSS Grid approach for the stats. It’s a clean 200px 1fr split on desktop that gracefully stacks into a single column on mobile. I also made sure the filter buttons wrap properly so nothing gets cut off.

Testing & Validation
I ran this through a few different scenarios to make sure it's production-ready (Used a test branch for good practice)

The Verified full rendering with a valid UUID.

Edge Cases: Tested with empty element scores to ensure the charts don't crash and instead show a helpful "No data" message.

Responsiveness: Manually checked the layout at 375px to ensure the stats and filter bars remain usable.

Logic: Verified that filter counts and sort orders map correctly to the displayed data.

I did use AI (claude) for a lot of the tasks. Had some issues with the PC and getting the docker to work so it was done blind which is bad practice. I also had a family emergency which did take up a lot of time but i did give it a good go. I could have done a few things better, reduce code bloat, add tailwind as it has proper styling for mobile, its easier to read and again reduces bloat.
