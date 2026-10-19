"""
==============================================================================
Widely Social — Widget Flotante Nativo de Escritorio (Windows)
==============================================================================
Píldora Always-On-Top 100% interactiva, sin marcos de navegador, sin pestañas,
sin barra de direcciones. Flota por encima de Figma, Illustrator, Photoshop,
Excel y cualquier software de diseño.
==============================================================================
"""

import tkinter as tk
from tkinter import font
import webbrowser
import time

class WidelyFloatingWidget:
    def __init__(self, root):
        self.root = root
        self.root.title("Widely Social Mini Tracker")
        
        # Configuración de ventana flotante de sistema sin bordes
        self.root.overrideredirect(True)
        self.root.wm_attributes("-topmost", True)
        
        # Color clave para transparencia en Windows
        self.trans_color = "#000001"
        self.root.wm_attributes("-transparentcolor", self.trans_color)
        self.root.configure(bg=self.trans_color)
        
        self.width = 440
        self.height = 76
        
        # Posicionar en la esquina inferior derecha por defecto
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        start_x = screen_w - self.width - 40
        start_y = screen_h - self.height - 80
        self.root.geometry(f"{self.width}x{self.height}+{start_x}+{start_y}")
        
        # Estado del cronómetro
        self.is_running = True
        self.elapsed_seconds = 0
        self.hourly_rate = 20.0  # USD por hora por defecto
        self.task_name = "Desarrollo Landing Page"
        self.last_tick = time.time()
        
        # Variables para arrastrar la ventana
        self._drag_data = {"x": 0, "y": 0}
        
        # Canvas principal para renderizar la píldora neón
        self.canvas = tk.Canvas(
            self.root,
            width=self.width,
            height=self.height,
            bg=self.trans_color,
            highlightthickness=0,
            cursor="hand2"
        )
        self.canvas.pack(fill="both", expand=True)
        
        self.draw_pill()
        self.setup_events()
        self.update_timer_loop()

    def draw_pill(self):
        self.canvas.delete("all")
        w, h = self.width, self.height
        
        # Borde degradado simulado (Cian -> Azul -> Violeta -> Rosa)
        r = 34
        # Fondo exterior negro obsidiana (#05070E)
        self.canvas.create_oval(4, 4, 4 + r * 2, h - 4, fill="#05070E", outline="#06B6D4", width=2)
        self.canvas.create_oval(w - 4 - r * 2, 4, w - 4, h - 4, fill="#05070E", outline="#F43F5E", width=2)
        self.canvas.create_rectangle(4 + r, 4, w - 4 - r, h - 4, fill="#05070E", outline="#05070E")
        self.canvas.create_line(4 + r, 4, w - 4 - r, 4, fill="#38BDF8", width=2)
        self.canvas.create_line(4 + r, h - 4, w - 4 - r, h - 4, fill="#8B5CF6", width=2)
        
        # 1. Icono Morado Izquierdo (#2D1537)
        icon_x = 18
        icon_y = (h - 36) // 2
        self.canvas.create_rectangle(icon_x, icon_y, icon_x + 36, icon_y + 36, fill="#2D1537", outline="#C084FC", width=1)
        # Glifo reloj
        cx = icon_x + 18
        cy = icon_y + 18
        self.canvas.create_oval(cx - 7, cy - 7, cx + 7, cy + 7, outline="#E9D5FF", width=1.5)
        self.canvas.create_line(cx, cy, cx, cy - 4, fill="#E9D5FF", width=1.5)
        self.canvas.create_line(cx, cy, cx + 3, cy, fill="#E9D5FF", width=1.5)
        
        # 2. Textos Centrales
        self.text_title_id = self.canvas.create_text(
            68, 26,
            text=self.task_name,
            fill="#FFFFFF",
            font=("Segoe UI", 10, "bold"),
            anchor="w"
        )
        
        time_str = self.format_time(self.elapsed_seconds)
        cost_str = f"${(self.elapsed_seconds / 3600.0) * self.hourly_rate:.2f} USD"
        self.text_sub_id = self.canvas.create_text(
            68, 48,
            text=f"{time_str} • {cost_str}",
            fill="#94A3B8",
            font=("Consolas", 10, "normal"),
            anchor="w"
        )
        
        # 3. Botón 1: Cian Pausa / Play
        btn1_cx = w - 88 + 17
        btn1_cy = h // 2
        self.btn1_oval = self.canvas.create_oval(
            btn1_cx - 17, btn1_cy - 17, btn1_cx + 17, btn1_cy + 17,
            fill="#082F49", outline="#06B6D4", width=2, tags="btn_play_pause"
        )
        self.btn1_icon = self.canvas.create_text(
            btn1_cx, btn1_cy,
            text="⏸" if self.is_running else "▶",
            fill="#22D3EE",
            font=("Segoe UI", 11, "bold"),
            tags="btn_play_pause"
        )
        
        # 4. Botón 2: Rojo Guardar / Stop
        btn2_cx = w - 44 + 17
        btn2_cy = h // 2
        self.btn2_oval = self.canvas.create_oval(
            btn2_cx - 17, btn2_cy - 17, btn2_cx + 17, btn2_cy + 17,
            fill="#450A0A", outline="#EF4444", width=2, tags="btn_stop"
        )
        self.btn2_icon = self.canvas.create_text(
            btn2_cx, btn2_cy,
            text="⏹",
            fill="#F87171",
            font=("Segoe UI", 10, "bold"),
            tags="btn_stop"
        )

    def setup_events(self):
        # Arrastrar la ventana manteniendo presionado el botón izquierdo
        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        
        # Clics específicos en los botones táctiles
        self.canvas.tag_bind("btn_play_pause", "<Button-1>", lambda e: self.toggle_play_pause())
        self.canvas.tag_bind("btn_stop", "<Button-1>", lambda e: self.stop_and_save())
        
        # Doble clic en cualquier parte de la píldora abre el Time Tracker web
        self.canvas.bind("<Double-Button-1>", lambda e: self.open_web_app())
        
        # Menú contextual con clic derecho
        self.menu = tk.Menu(self.root, tearoff=0)
        self.menu.add_command(label="Abrir Time Tracker Web", command=self.open_web_app)
        self.menu.add_separator()
        self.menu.add_command(label="Cerrar Widget Flotante", command=self.root.destroy)
        self.canvas.bind("<Button-3>", self.show_context_menu)

    def on_press(self, event):
        # No arrastrar si se hizo clic en un botón
        current = self.canvas.find_withtag("current")
        if current and ("btn_play_pause" in self.canvas.gettags(current) or "btn_stop" in self.canvas.gettags(current)):
            return
        self._drag_data["x"] = event.x_root - self.root.winfo_x()
        self._drag_data["y"] = event.y_root - self.root.winfo_y()

    def on_drag(self, event):
        current = self.canvas.find_withtag("current")
        if current and ("btn_play_pause" in self.canvas.gettags(current) or "btn_stop" in self.canvas.gettags(current)):
            return
        x = event.x_root - self._drag_data["x"]
        y = event.y_root - self._drag_data["y"]
        self.root.geometry(f"+{x}+{y}")

    def toggle_play_pause(self):
        self.is_running = not self.is_running
        self.canvas.itemconfig(self.btn1_icon, text="⏸" if self.is_running else "▶")

    def stop_and_save(self):
        self.is_running = False
        self.canvas.itemconfig(self.btn1_icon, text="▶")
        self.open_web_app()

    def open_web_app(self):
        webbrowser.open("https://johana-engineer.github.io/widely-time-tracker/")

    def show_context_menu(self, event):
        self.menu.post(event.x_root, event.y_root)

    def format_time(self, total_seconds):
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        s = total_seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"

    def update_timer_loop(self):
        if self.is_running:
            self.elapsed_seconds += 1
            time_str = self.format_time(self.elapsed_seconds)
            cost_str = f"${(self.elapsed_seconds / 3600.0) * self.hourly_rate:.2f} USD"
            self.canvas.itemconfig(self.text_sub_id, text=f"{time_str} • {cost_str}")
        self.root.after(1000, self.update_timer_loop)

if __name__ == "__main__":
    app_root = tk.Tk()
    widget = WidelyFloatingWidget(app_root)
    app_root.mainloop()
