import { useState, useRef, useEffect } from "react";
import { IoMdSearch } from "react-icons/io";
import { FaCartShopping } from "react-icons/fa6";
import { FaRegUser } from "react-icons/fa";
import { FaRegCircleQuestion } from "react-icons/fa6";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import { TbTruckDelivery } from "react-icons/tb";
import { MdDiscount } from "react-icons/md";
import { MdOutlineHomeRepairService } from "react-icons/md";

// Data moved outside component to prevent recreation on each render
const productLinks = [
  { 
    name: "Security Cameras", 
    href: "#",
    image: "src/asset/images/nav_camera.png"
  },
  { 
    name: "Thermostats", 
    href: "#",
    image: "src/asset/images/nav_kit.png"
  },
  { 
    name: "Smart Lighting", 
    href: "#",
    image: "src/asset/images/nav_light.png"
  },
  { 
    name: "Home Automation Kits", 
    href: "#",
    image: "src/asset/images/nav_kit.png"
  },
];

const discountLinks = [
  { 
    name: "Product Launch", 
    href: "#",
    image: "src/asset/images/nav_sales_1.png",
    description: "Exclusive deals on new releases"
  },
  { 
    name: "Seasonal Sales", 
    href: "#",
    image: "src/asset/images/nav_sales_2.png",
    description: "Limited-time offers on seasonal favorites"
  },
];

const serviceLinks = [
  { 
    name: "Book Installation", 
    href: "#",
    image: "src/asset/images/nav_installation.jpeg",
    description: "Professional setup by certified technicians"
  },
  { 
    name: "Track Orders", 
    href: "#",
    image: "src/asset/images/nav_tracking.png",
    description: "Check status of your purchases"
  },
];

const navLinks = [
  { name: "Products", href: "#", hasDropdown: true, dropdownType: "products" },
  { name: "Discounts", href: "#", hasDropdown: true, dropdownType: "discounts", icon: <MdDiscount className="text-lg" aria-hidden="true" /> },
  { name: "Services", href: "#", hasDropdown: true, dropdownType: "services", icon: <MdOutlineHomeRepairService className="text-lg" aria-hidden="true" /> },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const [cartCount, setCartCount] = useState(4); // Make dynamic

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
      
      // Close mobile menu when clicking outside
      if (mobileMenuOpen && 
          mobileMenuRef.current && 
          !mobileMenuRef.current.contains(event.target) &&
          !event.target.closest('button[aria-controls="mobile-menu"]')) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    
    // Handle escape key for accessibility
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener("keydown", handleEscKey);
    
    // Clean up event listeners
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const getDropdownContent = (type) => {
    switch(type) {
      case "products":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-6xl mx-auto px-4">
            {productLinks.map((product) => (
              <a
                key={product.name}
                href={product.href}
                className="flex flex-col items-center text-center group focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
              >
                <div className="mb-3 overflow-hidden rounded-lg transition-all duration-300 group-hover:shadow-md group-focus:shadow-md">
                  <img 
                    src={product.image} 
                    alt=""
                    aria-hidden="true"
                    className="w-full h-auto transition-transform duration-500 group-hover:scale-105 group-focus:scale-105" 
                  />
                </div>
                <span className="text-gray-800 font-medium group-hover:text-blue-600 group-focus:text-blue-600 transition-colors duration-300">{product.name}</span>
              </a>
            ))}
          </div>
        );
      case "discounts":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-6xl mx-auto px-4">
            {discountLinks.map((discount) => (
              <a
                key={discount.name}
                href={discount.href}
                className="flex flex-col items-center text-center group focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
              >
                <div className="mb-3 overflow-hidden rounded-lg transition-all duration-300 group-hover:shadow-md group-focus:shadow-md">
                  <img 
                    src={discount.image} 
                    alt=""
                    aria-hidden="true"
                    className="w-full h-auto transition-transform duration-500 group-hover:scale-105 group-focus:scale-105" 
                  />
                </div>
                <span className="text-gray-800 font-medium group-hover:text-blue-600 group-focus:text-blue-600 transition-colors duration-300">{discount.name}</span>
                <p className="mt-1 text-sm text-gray-600">{discount.description}</p>
              </a>
            ))}
          </div>
        );
      case "services":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-6xl mx-auto px-4">
            {serviceLinks.map((service) => (
              <a
                key={service.name}
                href={service.href}
                className="flex flex-col items-center text-center group focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
              >
                <div className="mb-3 overflow-hidden rounded-lg transition-all duration-300 group-hover:shadow-md group-focus:shadow-md">
                  <img 
                    src={service.image} 
                    alt=""
                    aria-hidden="true"
                    className="w-full h-auto transition-transform duration-500 group-hover:scale-105 group-focus:scale-105" 
                  />
                </div>
                <span className="text-gray-800 font-medium group-hover:text-blue-600 group-focus:text-blue-600 transition-colors duration-300">{service.name}</span>
                <p className="mt-1 text-sm text-gray-600">{service.description}</p>
              </a>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  // Moved to separate component for clarity
  const MobileNavItem = ({ link }) => (
    <div key={link.name} className="border-b border-gray-100 pb-2">
      <button
        onClick={() => setActiveDropdown(activeDropdown === link.name ? null : link.name)}
        className="flex w-full items-center justify-between py-3 font-medium text-gray-700 hover:text-blue-600 transition duration-300 text-sm md:text-base"
        aria-expanded={activeDropdown === link.name}
        aria-controls={`mobile-dropdown-${link.name}`}
      >
        <span className="flex items-center gap-2">
          {link.icon && link.icon}
          {link.name}
        </span>
        {activeDropdown === link.name ? 
          <IoClose className="text-xl" aria-hidden="true" /> : 
          <RxHamburgerMenu className="text-xl" aria-hidden="true" />
        }
      </button>
      
      {activeDropdown === link.name && (
        <div 
          id={`mobile-dropdown-${link.name}`}
          className="mt-4 grid grid-cols-2 gap-4 pb-2"
        >
          {link.dropdownType === "products" && productLinks.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
            >
              <div className="mb-2 rounded overflow-hidden">
                <img 
                  src={item.image} 
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto" 
                />
              </div>
              <span className="text-gray-700 font-medium">{item.name}</span>
              {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
            </a>
          ))}
          
          {link.dropdownType === "discounts" && discountLinks.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
            >
              <div className="mb-2 rounded overflow-hidden">
                <img 
                  src={item.image} 
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto" 
                />
              </div>
              <span className="text-gray-700 font-medium">{item.name}</span>
              {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
            </a>
          ))}
          
          {link.dropdownType === "services" && serviceLinks.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
            >
              <div className="mb-2 rounded overflow-hidden">
                <img 
                  src={item.image} 
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto" 
                />
              </div>
              <span className="text-gray-700 font-medium">{item.name}</span>
              {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className="bg-white shadow-sm w-full relative z-50">
      {/* Header container with custom CSS variable for dropdown positioning */}
      <div 
        className="py-3 md:py-4 w-full px-4 md:px-6 lg:px-8 flex items-center justify-between"
        style={{ "--header-height": "72px" }}
      >
        {/* Logo */}
          <a
            href="/"
            className="flex-shrink-0"
            aria-label="Smart Living Home Page"
          >
            <img 
              src="src/asset/images/logo.png" 
              alt="Smart Living" 
              className="h-40 md:h-30 w-auto" 
            />
          </a>

          {/* Desktop Navigation*/}
        <nav className="hidden lg:flex flex-1 justify-center" aria-label="Main Navigation">
          <div className="flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => (
              <div key={link.name} className="relative" ref={link.name === activeDropdown ? dropdownRef : null}>
                <button
                  className={`text-gray-700 text-sm font-medium hover:text-blue-600 transition duration-300 whitespace-nowrap flex items-center gap-1.5 py-3 px-2
                    ${activeDropdown === link.name ? 'text-blue-600 after:content-[""] after:absolute after:left-0 after:bottom-0 after:w-full after:h-0.5 after:bg-blue-600' : ''}
                  `}
                  onClick={() => setActiveDropdown(activeDropdown === link.name ? null : link.name)}
                  onMouseEnter={() => link.hasDropdown ? setActiveDropdown(link.name) : null}
                  aria-expanded={activeDropdown === link.name}
                  aria-controls={link.hasDropdown ? `dropdown-${link.name}` : undefined}
                >
                  {link.icon && link.icon}
                  {link.name}
                </button>
                
                {link.hasDropdown && activeDropdown === link.name && (
                  <div 
                    id={`dropdown-${link.name}`}
                    className="fixed left-0 right-0 w-full bg-white shadow-lg py-8 border-t border-gray-100"
                    style={{ top: 'var(--header-height, 72px)' }}
                    onMouseLeave={() => setActiveDropdown(null)}
                    role="menu"
                    aria-labelledby={`dropdown-${link.name}-button`}
                  >
                    {getDropdownContent(link.dropdownType)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Desktop Actions - Right side */}
        <div className="hidden lg:flex items-center gap-4 xl:gap-6 flex-shrink-0">
          <div className="relative flex items-center bg-gray-100 hover:bg-gray-200 rounded-full px-3 xl:px-4 py-2 min-w-[140px] xl:min-w-[180px] transition-colors duration-300">
            <label htmlFor="desktop-search" className="sr-only">Search products</label>
            <IoMdSearch className="text-gray-500" aria-hidden="true" />
            <input
              id="desktop-search"
              type="search"
              placeholder="Search products..."
              className="bg-transparent outline-none px-2 w-full text-sm xl:text-base"
            />
          </div>

          <div className="flex items-center gap-4 xl:gap-5">
            <a 
              href="/cart" 
              className="relative text-gray-600 hover:text-blue-600 transition-colors duration-300"
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <FaCartShopping className="text-xl xl:text-2xl" aria-hidden="true" />
              <div className="w-4 h-4 xl:w-5 xl:h-5 bg-blue-600 text-white rounded-full absolute -top-1 -right-2 flex items-center justify-center text-[10px] xl:text-xs font-medium">
                {cartCount}
              </div>
            </a>

            <a 
              href="/support" 
              className="text-gray-600 hover:text-blue-600 transition-colors duration-300" 
              aria-label="Support"
            >
              <FaRegCircleQuestion className="text-xl xl:text-2xl" aria-hidden="true" />
            </a>

            <a 
              href="/login" 
              className="text-gray-600 hover:text-blue-600 transition-colors duration-300" 
              aria-label="Sign In"
            >
              <FaRegUser className="text-xl xl:text-2xl" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Mobile/Tablet Actions */}
        <div className="flex lg:hidden items-center gap-4 ml-4">
          <a 
            href="/cart" 
            className="relative text-gray-600 hover:text-blue-600"
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <FaCartShopping className="text-2xl" aria-hidden="true" />
            <div className="w-4 h-4 bg-blue-600 text-white rounded-full absolute -top-1 -right-2 flex items-center justify-center text-[10px] font-medium">
              {cartCount}
            </div>
          </a>
          <button
            className="text-gray-600 hover:text-blue-600 text-2xl"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <IoClose aria-hidden="true" /> : <RxHamburgerMenu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Menu */}
      {mobileMenuOpen && (
        <div 
          id="mobile-menu"
          ref={mobileMenuRef}
          className="lg:hidden absolute top-full left-0 w-full bg-white shadow-lg z-50 px-4 py-6 border-t border-gray-100 max-h-[calc(100vh-72px)] overflow-y-auto"
        >
          <div className="max-w-2xl mx-auto">
            <nav className="grid gap-2 mb-6" aria-label="Mobile Navigation">
              {/* Mobile accordions for each nav section */}
              {navLinks.map((link) => (
                <MobileNavItem key={link.name} link={link} />
              ))}
            </nav>

            <div className="flex flex-col gap-4">
              <div className="relative flex items-center bg-gray-100 rounded-full px-4 py-2">
                <label htmlFor="mobile-search" className="sr-only">Search products</label>
                <IoMdSearch className="text-gray-500" aria-hidden="true" />
                <input
                  id="mobile-search"
                  type="search"
                  placeholder="Search products..."
                  className="bg-transparent outline-none px-2 w-full"
                />
              </div>

              <div className="grid gap-3 mt-4">
                <a 
                  href="/account" 
                  className="flex items-center gap-3 font-medium text-gray-700 hover:text-blue-600 focus:outline-none focus:text-blue-600"
                >
                  <FaRegUser className="text-xl" aria-hidden="true" />
                  <span>Sign In</span>
                </a>
                <a 
                  href="/support" 
                  className="flex items-center gap-3 font-medium text-gray-700 hover:text-blue-600 focus:outline-none focus:text-blue-600"
                >
                  <FaRegCircleQuestion className="text-xl" aria-hidden="true" />
                  <span>Support</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}