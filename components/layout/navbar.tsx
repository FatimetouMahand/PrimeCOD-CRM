import { Bell, Search } from "lucide-react";

export default function Navbar() {
  return (
    <header className="bg-white border-b px-5 md:px-8 py-4 flex items-center justify-between">
      <div className="hidden md:flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-lg w-[300px]">
        <Search size={18} />

        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent outline-none w-full"
        />
      </div>

      <div className="flex items-center gap-5 ml-auto">
        <button className="relative">
          <Bell size={22} />

          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1">
            2
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-semibold">
            A
          </div>

          <div className="hidden md:block">
            <p className="font-semibold">
              Admin
            </p>

            <p className="text-sm text-gray-500">
              Super Admin
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}