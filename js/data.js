/* College Diaries — shared data
   Sample stories live in this file.
   - Server mode: signed-in pages are fetched from the backend and cached
     locally for a fast first paint.
   - Preview mode: signed-in pages are stored in localStorage.

   These are classic scripts (not ES modules) so the site can be opened
   directly from index.html, served by Live Server, or served by server.js.
*/

var STORAGE_KEY = "collegeDiariesMemories";
var SERVER_CACHE_KEY = "collegeDiariesServerMemories";

var CATEGORIES = [
  "Campus Life",
  "Festivals",
  "Farewell",
  "Classroom",
  "Friendship",
  "Sports"
];

var FIELD_LIMITS = {
  title: 80,
  author: 60,
  description: 800,
  image: 500
};

var SAMPLE_MEMORIES = [
  {
    id: "first-day",
    title: "First Day at College",
    author: "Ananya Rao",
    category: "Campus Life",
    date: "2024-08-12",
    image: "https://images.pexels.com/photos/1454360/pexels-photo-1454360.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "The gates looked bigger than they did in the brochure. I arrived with a too-heavy backpack, a folded timetable, and a name I was afraid to mispronounce. By lunch, a stranger had saved me a seat under the banyan tree and walked me to the wrong building twice. We laughed until the nervousness finally left. That first walk across the quad still feels like the real beginning of college."
  },
  {
    id: "college-fest",
    title: "College Fest",
    author: "Kabir Mehta",
    category: "Festivals",
    date: "2025-02-18",
    image: "https://images.pexels.com/photos/32399568/pexels-photo-32399568.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "The main stage lit up just after sunset, and the whole lawn turned into one long chorus. We had spent a week painting banners in the art room, and seeing them sway above the crowd made every late night worth it. Someone passed paper cups of chai between songs. For three hours, assignments did not exist. Only lights, friends, and a chorus we still hum in the corridor."
  },
  {
    id: "farewell",
    title: "Farewell Memories",
    author: "Meera Iyer",
    category: "Farewell",
    date: "2025-04-09",
    image: "https://images.pexels.com/photos/30562665/pexels-photo-30562665.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "We promised we would not cry, and then the first speech mentioned the hostel terrace. Caps went up, phones came out, and suddenly four years folded into one bright afternoon. I kept a pressed flower from the bouquet our juniors made. Farewell was not an ending. It was the campus asking us to carry it with us."
  },
  {
    id: "classroom",
    title: "Classroom Moments",
    author: "Arjun Desai",
    category: "Classroom",
    date: "2024-11-03",
    image: "https://images.pexels.com/photos/8197551/pexels-photo-8197551.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "Room 214 always smelled faintly of chalk and rain. Our professor paused mid-lecture because the back bench had turned a difficult proof into a doodle war. Instead of scolding us, she asked who could explain the idea in one sentence. The quietest student did, and the room applauded like it was a fest. I still open that notebook when I need to remember why I chose this subject."
  },
  {
    id: "friends-forever",
    title: "Friends Forever",
    author: "Sara Khan",
    category: "Friendship",
    date: "2024-10-21",
    image: "https://images.pexels.com/photos/7972677/pexels-photo-7972677.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "We were supposed to revise for the mid-semester test. We made it as far as the lawn, then spent the evening trading stories about home, bad canteen samosas, and the professor who never forgot a face. Somewhere between shared notes and shared umbrellas, the group chat became a second home. These are the people I will call first, years from now."
  },
  {
    id: "sports-day",
    title: "Sports Day",
    author: "Rohan Patel",
    category: "Sports",
    date: "2025-01-14",
    image: "https://images.pexels.com/photos/37169819/pexels-photo-37169819.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "The bat was heavier than it looked in practice, the crowd was louder than any lecture hall, and our house flag kept wrapping around the pole. We did not win the trophy, but we won the last over, and the whole stand stood up. Sports Day reminded me that college is not only classrooms. It is also dust on your shoes and a teammate yelling your name."
  },
  {
    id: "library-after-dark",
    title: "The Library After Dark",
    author: "Priya Nair",
    category: "Classroom",
    date: "2024-12-06",
    image: "https://images.pexels.com/photos/8199558/pexels-photo-8199558.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "The reading room lamps made a warm island in an otherwise quiet building. We claimed the long table by the window and built a small fortress of borrowed books. At ten, someone whispered that the canteen was still open. We stayed anyway, because the page finally made sense. Some of my favourite college hours had no audience at all."
  },
  {
    id: "golden-hour",
    title: "Golden Hour on the Quad",
    author: "Dev Sharma",
    category: "Campus Life",
    date: "2024-09-19",
    image: "https://images.pexels.com/photos/5553036/pexels-photo-5553036.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
    description: "Between the last class and the hostel bell, the quad turned honey-coloured. We walked slowly on purpose, backpacks half zipped, talking about nothing important. A senior waved from the steps of the old brick block. I took one photograph and then put the phone away. Some afternoons should be remembered with your eyes, not only your camera."
  }
];

/* Creates an element and sets plain text. Do not pass HTML to this helper. */
function createElement(tag, className, text) {
  var element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }
  return element;
}

function isValidMemory(item) {
  if (!item) {
    return false;
  }
  return typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.author === "string" &&
    typeof item.category === "string" &&
    typeof item.date === "string" &&
    typeof item.description === "string";
}

function storageAvailable() {
  try {
    var testKey = "collegeDiariesStorageTest";
    localStorage.setItem(testKey, "ok");
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

function readMemoryList(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidMemory);
  } catch (error) {
    return [];
  }
}

function readServerCache() {
  return readMemoryList(SERVER_CACHE_KEY);
}

function replaceServerCache(memories) {
  var cleaned = memories.filter(isValidMemory);
  try {
    localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(cleaned));
  } catch (error) {
    /* The feed still works for this visit when browser storage is unavailable. */
  }
}

function cacheServerMemory(memory) {
  if (!isValidMemory(memory)) {
    return;
  }
  var existing = readServerCache().filter(function (item) {
    return item.id !== memory.id;
  });
  existing.unshift(memory);
  replaceServerCache(existing);
}

function getUserMemories() {
  var localMemories = readMemoryList(STORAGE_KEY);
  var serverMemories = readServerCache();
  var seen = {};
  return serverMemories.concat(localMemories).filter(function (memory) {
    if (seen[memory.id]) {
      return false;
    }
    seen[memory.id] = true;
    return true;
  });
}

function getAllMemories() {
  var userMemories = getUserMemories().slice().sort(function (a, b) {
    var aKey = a.createdAt || a.date;
    var bKey = b.createdAt || b.date;
    if (aKey === bKey) {
      return 0;
    }
    return aKey < bKey ? 1 : -1;
  });
  return userMemories.concat(SAMPLE_MEMORIES);
}

function getMemoryById(id) {
  if (!id) {
    return null;
  }
  var memories = getAllMemories();
  for (var i = 0; i < memories.length; i += 1) {
    if (memories[i].id === id) {
      return memories[i];
    }
  }
  return null;
}

function saveUserMemory(memory) {
  var existing = readMemoryList(STORAGE_KEY);
  existing.unshift(memory);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

function getCategoryNames() {
  var names = CATEGORIES.slice();
  getAllMemories().forEach(function (memory) {
    if (memory.category && names.indexOf(memory.category) === -1) {
      names.push(memory.category);
    }
  });
  return names;
}

function fillCategoryOptions(selectElement, categories, placeholderText) {
  if (!selectElement) {
    return;
  }
  var current = selectElement.value;
  selectElement.replaceChildren();
  var placeholder = createElement("option", "", placeholderText);
  placeholder.value = "";
  selectElement.appendChild(placeholder);
  categories.forEach(function (category) {
    var option = createElement("option", "", category);
    option.value = category;
    selectElement.appendChild(option);
  });
  selectElement.value = current;
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  var date = new Date(String(value).indexOf("T") === -1 ? value + "T00:00:00" : value);
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function isSafeImageUrl(url) {
  if (!url) {
    return false;
  }
  try {
    var parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return Boolean(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function getSafeImage(url) {
  if (typeof url !== "string") {
    return "";
  }
  var trimmed = url.trim();
  if (!trimmed || trimmed.length > FIELD_LIMITS.image) {
    return "";
  }
  return isSafeImageUrl(trimmed) ? trimmed : "";
}

function createMemoryId() {
  return "mem-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
