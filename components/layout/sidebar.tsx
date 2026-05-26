import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
} from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 bg-white border-r min-h-screen p-5 flex-col">
      <h2 className="text-2xl font-bold">
        CRM Dashboard
      </h2>

      <nav className="mt-10 flex flex-col gap-2">
        <button className="flex items-center gap-3 rounded-lg bg-black text-white px-4 py-3">
          <LayoutDashboard size={20} />
          Dashboard
        </button>

        <button className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-gray-100 transition">
          <ShoppingCart size={20} />
          Orders
        </button>

        <button className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-gray-100 transition">
          <Users size={20} />
          Employees
        </button>

        <button className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-gray-100 transition">
          <Package size={20} />
          Products
        </button>

        <button className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-gray-100 transition">
          <Settings size={20} />
          Settings
        </button>
      </nav>
    </aside>
  );
}